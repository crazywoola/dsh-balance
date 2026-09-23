import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BalanceDock } from '../src/client/BalanceDock.tsx'
import type { BalanceDockInjected, BalanceDockProps } from '../src/client/BalanceDock.tsx'
import { BillingOverview } from '../src/client/BillingTab.tsx'
import type { UsageTabInjected } from '../src/client/BillingTab.tsx'
import type { BalanceApiResponse } from '../src/types.ts'
import type { UsageApiResponse, UsageTotals } from '../src/billing.ts'
import { en } from '../src/client/locales.ts'

const t: BalanceDockProps['t'] = (key, values) => Object.entries(values ?? {}).reduce(
  (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), (en as Record<string, string>)[key] ?? key,
)
const roots: ReactTestRenderer[] = []
beforeEach(() => { vi.stubGlobal('window', globalThis); vi.useFakeTimers() })
afterEach(() => {
  act(() => { roots.splice(0).forEach(root => root.unmount()) })
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function directory(provider = 'deepseek', model = 'deepseek-v4-flash') {
  let snapshot = { current: { provider, model }, status: 'ready' as const }
  const listeners = new Set<() => void>()
  return {
    store: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    },
    load: vi.fn(async () => {}),
    select: (provider: string, model: string) => { snapshot = { ...snapshot, current: { provider, model } }; listeners.forEach(listener => listener()) },
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
function balance(totalBalance: string, isAvailable: boolean | null = true): BalanceApiResponse {
  return { ok: true, fetchedAt: new Date().toISOString(), source: 'live', isAvailable, balanceInfos: [{ currency: 'USD', totalBalance }] }
}
function dockProps(selection: BalanceDockInjected['selection'], loadBalance: BalanceDockInjected['loadBalance'], sessionId = 'a') {
  return { selection, loadBalance, t, sessionId } as BalanceDockProps
}

describe('live composer selection', () => {
  it('switches provider and model, clears stale balances, ignores late responses, and does not query unsupported providers', async () => {
    const pending = [deferred<BalanceApiResponse>(), deferred<BalanceApiResponse>(), deferred<BalanceApiResponse>()]
    const loadBalance = vi.fn<BalanceDockInjected['loadBalance']>().mockImplementationOnce(() => pending[0]!.promise)
      .mockImplementationOnce(() => pending[1]!.promise).mockImplementationOnce(() => pending[2]!.promise)
    const selection = directory()
    let root!: ReactTestRenderer
    await act(async () => { root = create(createElement(BalanceDock, dockProps(selection, loadBalance))); roots.push(root) })
    await act(async () => { pending[0]!.resolve(balance('10')) })
    expect(JSON.stringify(root.toJSON())).toContain('DeepSeek Balance')
    expect(JSON.stringify(root.toJSON())).toContain('$10.00')
    act(() => selection.select('StepFun', 'step-3.5-flash'))
    expect(loadBalance.mock.calls[1]?.[2]).toBe('stepfun')
    expect(JSON.stringify(root.toJSON())).not.toContain('$10.00')
    expect(JSON.stringify(root.toJSON())).toContain('step-3.5-flash')
    expect(root.root.findByProps({ className: 'dsh-balance-dock' }).props.title).toBeUndefined()
    act(() => selection.select('DEEPSEEK', 'deepseek-v4-pro'))
    expect(loadBalance.mock.calls[1]?.[1].aborted).toBe(true)
    await act(async () => { pending[2]!.resolve(balance('31')); pending[1]!.resolve(balance('999')) })
    expect(JSON.stringify(root.toJSON())).toContain('DeepSeek Balance')
    expect(JSON.stringify(root.toJSON())).toContain('$31.00')
    expect(JSON.stringify(root.toJSON())).not.toContain('$999.00')
    act(() => selection.select('DEEPSEEK', 'another-model'))
    expect(loadBalance).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(root.toJSON())).toContain('another-model')
    act(() => selection.select('custom', 'private-model'))
    expect(JSON.stringify(root.toJSON())).toContain('not supported')
    expect(JSON.stringify(root.toJSON())).not.toContain('$31.00')
    expect(loadBalance).toHaveBeenCalledTimes(3)
  })

  it('follows session changes and treats StepFun availability as unknown', async () => {
    const pending = deferred<BalanceApiResponse>()
    const loadBalance = vi.fn<BalanceDockInjected['loadBalance']>().mockImplementationOnce(() => pending.promise).mockResolvedValue(balance('0', null))
    let root!: ReactTestRenderer
    await act(async () => { root = create(createElement(BalanceDock, dockProps(directory(), loadBalance))); roots.push(root) })
    await act(async () => { root.update(createElement(BalanceDock, dockProps(directory('StepFun', 'step-model'), loadBalance, 'b'))) })
    expect(loadBalance.mock.calls[0]?.[1].aborted).toBe(true)
    await act(async () => { pending.resolve(balance('999')) })
    expect(JSON.stringify(root.toJSON())).not.toContain('$999.00')
    expect(root.root.findByProps({ className: 'dsh-balance-dock-dot' }).props['data-state']).toBe('unknown')
    expect(JSON.stringify(root.toJSON())).not.toContain('no available balance')
  })

  it('does not guess DeepSeek while the initial selection loads', async () => {
    const loadBalance = vi.fn<BalanceDockInjected['loadBalance']>()
    const selection = { store: { subscribe: () => () => {}, getSnapshot: () => snapshot }, load: vi.fn(async () => {}) }
    const snapshot = { current: null, status: 'idle' as const }
    let root!: ReactTestRenderer
    await act(async () => { root = create(createElement(BalanceDock, dockProps(selection, loadBalance))); roots.push(root) })
    expect(selection.load).toHaveBeenCalledTimes(1)
    expect(loadBalance).not.toHaveBeenCalled()
    expect(JSON.stringify(root.toJSON())).toContain('Current model not available yet')
  })
})

function usage(inputTokens: number): UsageApiResponse {
  const totals: UsageTotals = { requests: 1, pricedRequests: 0, unpricedRequests: 1, inputTokens, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40, costUsd: 0, costCny: null }
  return { ok: true, scope: 'all', fetchedAt: new Date().toISOString(), source: 'live', summary: { timeZone: 'UTC', usdToCny: null, totals, byDay: [], bySession: [], byModel: [] } }
}

it('filters statistics by provider, cancels refreshes on changes, and includes cached tokens in the total', async () => {
  const first = deferred<UsageApiResponse>()
  const refresh = deferred<UsageApiResponse>()
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockImplementationOnce(() => first.promise).mockResolvedValueOnce(usage(10)).mockImplementationOnce(() => refresh.promise).mockResolvedValueOnce(usage(100))
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingOverview, { provider: 'deepseek', loadUsage, t })); roots.push(root) })
  await act(async () => { root.update(createElement(BillingOverview, { provider: 'stepfun', loadUsage, t })) })
  expect(loadUsage.mock.calls[0]?.[1].aborted).toBe(true)
  expect(loadUsage.mock.calls[1]?.[0].provider).toBe('stepfun')
  await act(async () => { first.resolve(usage(999)) })
  const cards = root.root.findAllByType('strong').map(node => node.children.join(''))
  expect(cards).toContain('100') // 10 uncached + 20 output + 30 cache read + 40 cache write
  expect(cards).toContain('Unpriced')
  expect(cards).not.toContain('1,089')
  act(() => root.root.findByType('button').props.onClick())
  await act(async () => { root.update(createElement(BillingOverview, { provider: 'deepseek', loadUsage, t })) })
  expect(loadUsage.mock.calls[2]?.[1].aborted).toBe(true)
  await act(async () => { refresh.resolve(usage(999)) })
  expect(root.root.findAllByType('strong').map(node => node.children.join(''))).toContain('190')
})

it('queries the official DeepSeek account while preserving the selected deepseek-flash model', async () => {
  const loadBalance = vi.fn<BalanceDockInjected['loadBalance']>().mockResolvedValue(balance('12'))
  let root!: ReactTestRenderer
  await act(async () => {
    root = create(createElement(BalanceDock, dockProps(directory('deepseek-official', 'deepseek-flash'), loadBalance)))
    roots.push(root)
  })
  expect(loadBalance).toHaveBeenCalledWith(false, expect.any(AbortSignal), 'deepseek')
  expect(JSON.stringify(root.toJSON())).toContain('DeepSeek Balance')
  expect(JSON.stringify(root.toJSON())).toContain('deepseek-flash')
  expect(JSON.stringify(root.toJSON())).toContain('$12.00')
  expect(JSON.stringify(root.toJSON())).not.toContain('not supported')
})
