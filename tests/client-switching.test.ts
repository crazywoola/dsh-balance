import { SessionId } from '@deepseek-ai/dsh-session'
import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BalanceDock } from '../src/client/BalanceDock.tsx'
import type { BalanceDockInjected, BalanceDockProps } from '../src/client/BalanceDock.tsx'
import { BillingOverview, BillingView, isDateValue, monthProjection, PeriodComparison, primaryMetric, readStoredRate, resolveUsageDates, shiftDate, writeStoredRate } from '../src/client/BillingTab.tsx'
import { Dropdown } from '../src/client/Dropdown.tsx'
import type { BillingViewProps, UsageLoadOptions, UsageTabInjected } from '../src/client/BillingTab.tsx'
import { BalanceSection } from '../src/client/BalanceTab.tsx'
import type { BalanceTabInjected } from '../src/client/BalanceTab.tsx'
import { ModelsSection } from '../src/client/ModelsTab.tsx'
import type { ModelsTabInjected } from '../src/client/ModelsTab.tsx'
import type { BalanceApiResponse } from '../src/types.ts'
import type { UsageApiResponse, UsageSummary, UsageTotals } from '../src/billing.ts'
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
  const totals: UsageTotals = { requests: 1, pricedRequests: 0, freeRequests: 0, unpricedRequests: 1, inputTokens, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40, costUsd: 0, costCny: null, nativeCostCny: 0, cnyPricedRequests: 0, hasCompleteCnyTotal: true }
  return { ok: true, scope: 'all', fetchedAt: new Date().toISOString(), source: 'live', summary: { timeZone: 'UTC', usdToCny: null, cnyTotalMode: 'unavailable', totals, byWeekdayHour: [], byProvider: [], byDay: [], bySession: [], byModel: [] } }
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
  act(() => root.root.findByProps({ 'aria-label': 'Refresh usage' }).props.onClick())
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


it('renders current Harness session snapshots and refreshes when usage or running state changes', async () => {
  let running = false
  let tokens = { uncachedInputTokens: 10, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 }
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValue({ ok: false, code: 'SESSION_NOT_FOUND', message: '' })
  // Current Harness snapshots carry lifecycle state, not conversation nodes.
  const props = {
    sessionId: 'a', t, loadUsage,
    useSession: (select: (snapshot: { running: boolean }) => unknown) => select({ running }),
    useProjection: (key: string) => { expect(key).toBe('tokenUsage'); return tokens },
  } as BillingViewProps
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingView, props)); roots.push(root) })
  expect(loadUsage).toHaveBeenCalledTimes(1)
  tokens = { ...tokens, outputTokens: 40 }
  await act(async () => { root.update(createElement(BillingView, props)) })
  expect(loadUsage).toHaveBeenCalledTimes(2)
  running = true
  await act(async () => { root.update(createElement(BillingView, props)) })
  running = false
  await act(async () => { root.update(createElement(BillingView, props)) })
  expect(loadUsage).toHaveBeenCalledTimes(4)
})


it('shows all providers on the standalone page and refreshes saved statistics while open', async () => {
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValue(usage(10))
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingOverview, { loadUsage, t })); roots.push(root) })
  expect(loadUsage.mock.calls[0]?.[0]).toMatchObject({ scope: 'all' })
  expect(loadUsage.mock.calls[0]?.[0].provider).toBeUndefined()
  expect(loadUsage.mock.calls[0]?.[0].from).toBeUndefined()
  await act(async () => { vi.advanceTimersByTime(15_000) })
  expect(loadUsage).toHaveBeenCalledTimes(2)
  act(() => root.unmount())
  await act(async () => { vi.advanceTimersByTime(30_000) })
  expect(loadUsage).toHaveBeenCalledTimes(2)
})

it('labels incomplete statistics and removes the notice after unreadable sessions recover', async () => {
  const partial = usage(123)
  if (!partial.ok || partial.scope !== 'all') throw new Error('invalid fixture')
  partial.coverage = { readSessions: 37, skippedSessions: 3 }
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValueOnce(partial).mockResolvedValue(usage(456))
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingOverview, { loadUsage, t })); roots.push(root) })
  expect(JSON.stringify(root.toJSON())).toContain('3 sessions could not be read')
  expect(JSON.stringify(root.toJSON())).toContain('The statistics below exclude these sessions')
  expect(JSON.stringify(root.toJSON())).toContain('123')
  await act(async () => { vi.advanceTimersByTime(15_000) })
  expect(JSON.stringify(root.toJSON())).not.toContain('sessions could not be read')
  expect(JSON.stringify(root.toJSON())).toContain('456')
})

it('shows one category at a time, paginates long lists, and clamps the page after a refresh', async () => {
  const result = usage(10)
  if (!result.ok || result.scope !== 'all') throw new Error('invalid fixture')
  result.summary.byModel = Array.from({ length: 23 }, (_, index) => ({ ...result.summary.totals, provider: 'deepseek', model: `long-model-name-${index}` }))
  result.summary.bySession = [{ ...result.summary.totals, sessionId: 'a', title: 'A very long conversation title' }]
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValue(result)
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingOverview, { loadUsage, t })); roots.push(root) })
  const rows = () => root.root.findAllByProps({ className: 'dsh-billing-list-row' })
  expect(rows()).toHaveLength(10)
  expect(JSON.stringify(root.toJSON())).not.toContain('A very long conversation title')
  act(() => root.root.findByProps({ 'aria-label': 'Next page' }).props.onClick())
  expect(rows()).toHaveLength(10)
  expect(rows()[0]!.findByType('code').children.join('')).toBe('long-model-name-10')
  act(() => root.root.findByProps({ 'aria-label': 'Next page' }).props.onClick())
  expect(rows()).toHaveLength(3)
  expect(root.root.findByProps({ 'aria-label': 'Next page' }).props.disabled).toBe(true)
  result.summary.byModel = result.summary.byModel.slice(0, 2)
  await act(async () => { vi.advanceTimersByTime(15_000) })
  expect(rows()).toHaveLength(2)
  expect(rows()[0]!.findByType('code').children.join('')).toBe('long-model-name-0')
  act(() => root.root.findAllByProps({ role: 'tab' })[2]!.props.onClick())
  expect(rows()).toHaveLength(1)
  expect(JSON.stringify(root.toJSON())).toContain('A very long conversation title')
  const sessionTab = root.root.findAllByProps({ role: 'tab' })[2]!
  act(() => sessionTab.props.onKeyDown({ key: 'Home', preventDefault: vi.fn() }))
  expect(root.root.findAllByProps({ role: 'tab' })[0]!.props['aria-selected']).toBe(true)
})

it('filters and paginates session requests while preserving full model identifiers', async () => {
  const base = usage(10)
  if (!base.ok || base.scope !== 'all') throw new Error('invalid fixture')
  const requests = Array.from({ length: 24 }, (_, index) => ({ sessionId: 'a', inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 0, costUsd: null, billingStatus: 'unpriced' as const, seq: index, time: new Date().toISOString(), turn: 1, step: index, provider: 'deepseek', model: index % 2 === 0 ? 'very-long-model-identifier-a' : 'model-b' }))
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValue({ ok: true, scope: 'session', fetchedAt: new Date().toISOString(), source: 'live', summary: base.summary, session: { ...base.summary.totals, sessionId: 'a', title: 'a' }, requests })
  const props = { sessionId: 'a', t, loadUsage, useSession: () => false, useProjection: () => ({}) } as BillingViewProps
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingView, props)); roots.push(root) })
  act(() => root.root.findAllByProps({ role: 'tab' })[1]!.props.onClick())
  const rows = () => root.root.findAllByProps({ className: 'dsh-billing-request-row' })
  expect(rows()).toHaveLength(10)
  act(() => root.root.findByProps({ 'aria-label': 'Next page' }).props.onClick())
  const filter = root.root.findAllByType(Dropdown).find(item => item.props.label === 'Filter models')!
  act(() => filter.props.onChange(JSON.stringify(['deepseek', 'very-long-model-identifier-a'])))
  expect(rows()).toHaveLength(10)
  expect(rows()[0]!.findByType('code').props.title).toBe('deepseek / very-long-model-identifier-a')
  expect(rows().every(row => row.findByType('code').children.join('') === 'very-long-model-identifier-a')).toBe(true)
  act(() => root.root.findByProps({ 'aria-label': 'Next page' }).props.onClick())
  expect(rows()).toHaveLength(2)
  expect(loadUsage).toHaveBeenCalledOnce()
})

it('clears previous conversation statistics and ignores their delayed response', async () => {
  const pending = deferred<UsageApiResponse>()
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockImplementationOnce(() => pending.promise).mockResolvedValue({ ok: false, code: 'SESSION_NOT_FOUND', message: 'session b' })
  const props = { sessionId: 'a', t, loadUsage, useSession: () => false, useProjection: () => ({}) } as BillingViewProps
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingView, props)); roots.push(root) })
  await act(async () => { root.update(createElement(BillingView, { ...props, sessionId: SessionId('b') })) })
  expect(loadUsage.mock.calls[0]?.[1].aborted).toBe(true)
  expect(loadUsage.mock.calls[1]?.[0].sessionId).toBe('b')
  await act(async () => pending.resolve(usage(999)))
  expect(JSON.stringify(root.toJSON())).toContain('session b')
  expect(JSON.stringify(root.toJSON())).not.toContain('999')
})

it('renders native CNY estimates without presenting them as zero USD and retains unknown request warnings', async () => {
  const response = usage(10)
  if (!response.ok || response.scope !== 'all') throw new Error('invalid fixture')
  response.summary.totals = { ...response.summary.totals, requests: 2, pricedRequests: 1, unpricedRequests: 1, nativeCostCny: 6.5815412, cnyPricedRequests: 1, costCny: 6.5815412 }
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValue(response)
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingOverview, { loadUsage, t })); roots.push(root) })
  const totalCost = root.root.findByProps({ className: 'dsh-billing-card dsh-billing-card-primary' })
  expect(totalCost.findByType('strong').children.join('')).toContain('6.5815412')
  expect(totalCost.findByType('strong').children.join('')).not.toContain('$0.00')
  expect(JSON.stringify(root.toJSON())).toContain('Requests with known pricing only')
})

it('recognizes Tokener in the composer without requesting an undocumented balance API', async () => {
  const loadBalance = vi.fn<BalanceDockInjected['loadBalance']>().mockResolvedValue(balance('12'))
  const selection = directory()
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BalanceDock, dockProps(selection, loadBalance))); roots.push(root) })
  await act(async () => { selection.select('TOKENER.AI', 'gpt-5.4') })
  expect(JSON.stringify(root.toJSON())).toContain('Tokener usage')
  expect(JSON.stringify(root.toJSON())).toContain('See Usage Statistics')
  expect(JSON.stringify(root.toJSON())).toContain('gpt-5.4')
  expect(JSON.stringify(root.toJSON())).not.toContain('$12.00')
  await act(async () => { vi.advanceTimersByTime(60_000) })
  expect(loadBalance).toHaveBeenCalledOnce()
  expect(root.root.findByProps({ className: 'dsh-balance-dock-dot' }).props['data-state']).toBe('unknown')
})

describe('usage range and time-zone helpers', () => {
  it('resolves presets, custom ranges and invalid input', () => {
    expect(resolveUsageDates('all', { from: '', to: '' }, '2026-11-09')).toEqual({})
    expect(resolveUsageDates('today', { from: '', to: '' }, '2026-11-09')).toEqual({ from: '2026-11-09', to: '2026-11-09' })
    expect(resolveUsageDates('7d', { from: '', to: '' }, '2026-11-09')).toEqual({ from: '2026-11-03', to: '2026-11-09' })
    expect(resolveUsageDates('30d', { from: '', to: '' }, '2026-11-09')).toEqual({ from: '2026-10-11', to: '2026-11-09' })
    expect(resolveUsageDates('custom', { from: '2026-10-01', to: '2026-10-31' }, '2026-11-09')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(resolveUsageDates('custom', { from: '2026-10-31', to: '2026-10-01' }, '2026-11-09')).toBeUndefined()
    expect(resolveUsageDates('custom', { from: '', to: '2026-10-01' }, '2026-11-09')).toBeUndefined()
    expect(resolveUsageDates('custom', { from: '2026-02-30', to: '2026-03-01' }, '2026-11-09')).toBeUndefined()
  })

  it('validates and shifts calendar dates', () => {
    expect(isDateValue('2026-02-29')).toBe(false)
    expect(isDateValue('2024-02-29')).toBe(true)
    expect(isDateValue('2026-13-01')).toBe(false)
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2024-03-01', -1)).toBe('2024-02-29')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('leads with USD unless every priced request is native CNY or nothing is priced', () => {
    const base = { requests: 1, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    expect(primaryMetric({ ...base, pricedRequests: 1, freeRequests: 0, unpricedRequests: 0, costUsd: 2, costCny: null, nativeCostCny: 0, cnyPricedRequests: 0, hasCompleteCnyTotal: true }))
      .toEqual({ value: 2, currency: 'USD', unpriced: false })
    expect(primaryMetric({ ...base, pricedRequests: 1, freeRequests: 0, unpricedRequests: 0, costUsd: 0, costCny: 14, nativeCostCny: 14, cnyPricedRequests: 1, hasCompleteCnyTotal: false }))
      .toEqual({ value: 14, currency: 'CNY', unpriced: false })
    expect(primaryMetric({ ...base, pricedRequests: 0, freeRequests: 0, unpricedRequests: 3, costUsd: 0, costCny: null, nativeCostCny: 0, cnyPricedRequests: 0, hasCompleteCnyTotal: true }))
      .toEqual({ value: null, currency: 'USD', unpriced: true })
  })

  it('projects the current month from month-to-date spend', () => {
    const totals: UsageTotals = { requests: 2, pricedRequests: 2, freeRequests: 0, unpricedRequests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 3, costCny: null, nativeCostCny: 0, cnyPricedRequests: 0, hasCompleteCnyTotal: true }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const elapsed = Number(today.slice(8, 10))
    const total = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate()
    const summary = { timeZone: 'UTC', usdToCny: null, cnyTotalMode: 'unavailable', totals, byProvider: [], byModel: [], bySession: [], byWeekdayHour: [], byDay: [{ ...totals, date: today }] } as UsageSummary
    expect(monthProjection(summary)).toEqual({ amount: 3 / elapsed * total, elapsed, total })
    expect(monthProjection({ ...summary, byDay: [] })).toBeUndefined()
  })
})

describe('period comparison', () => {
  const previousOptions: UsageLoadOptions = { scope: 'all', timeZone: 'UTC', from: '2026-10-25', to: '2026-10-31' }
  const totals = (costUsd: number): UsageTotals => ({ requests: 1, pricedRequests: 1, freeRequests: 0, unpricedRequests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd, costCny: null, nativeCostCny: 0, cnyPricedRequests: 0, hasCompleteCnyTotal: true })
  const all = (costUsd: number): UsageApiResponse => ({ ok: true, scope: 'all', fetchedAt: new Date().toISOString(), source: 'live', summary: { timeZone: 'UTC', usdToCny: null, cnyTotalMode: 'unavailable', totals: totals(costUsd), byProvider: [], byModel: [], bySession: [], byWeekdayHour: [], byDay: [] } })

  async function render(current: UsageApiResponse | undefined, previous: UsageApiResponse) {
    const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValue(previous)
    let root!: ReactTestRenderer
    await act(async () => { root = create(createElement(PeriodComparison, { load: loadUsage, previousOptions, current, t })); roots.push(root) })
    return root
  }

  it('renders the delta against the previous period', async () => {
    const root = await render(all(3), all(2))
    expect(JSON.stringify(root.toJSON())).toContain('+50%')
    expect(JSON.stringify(root.toJSON())).toContain('$2.00 → $3.00')
  })

  it('labels a previous period without records, flat periods and incomparable currencies', async () => {
    expect(JSON.stringify((await render(all(3), all(0))).toJSON())).toContain('No records in the previous period')
    expect(JSON.stringify((await render(all(2), all(2))).toJSON())).toContain('Roughly flat')
    const cny = all(0)
    if (!cny.ok || cny.scope !== 'all') throw new Error('invalid fixture')
    cny.summary.totals = { ...cny.summary.totals, nativeCostCny: 14, cnyPricedRequests: 1, costCny: 14 }
    expect(JSON.stringify((await render(cny, all(2))).toJSON())).toBe('null')
  })

  it('stays silent without a current result and reports an unavailable previous period', async () => {
    expect(JSON.stringify((await render(undefined, all(2))).toJSON())).toBe('null')
    expect(JSON.stringify((await render(all(2), { ok: false, code: 'UPSTREAM_UNAVAILABLE', message: '' })).toJSON())).toContain('No comparable data')
  })
})

it('projects the current month under the total cost card', async () => {
  const result = usage(10)
  if (!result.ok || result.scope !== 'all') throw new Error('invalid fixture')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  result.summary.totals = { ...result.summary.totals, pricedRequests: 1, unpricedRequests: 0, costUsd: 3, hasCompleteCnyTotal: true }
  result.summary.byDay = [{ ...result.summary.totals, date: today }]
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValue(result)
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingOverview, { loadUsage, t })); roots.push(root) })
  expect(JSON.stringify(root.toJSON())).toContain('Projected this month')
})

it('annotates catalogued model prices and marks unknown ones', async () => {
  const loadModels = vi.fn<ModelsTabInjected['loadModels']>().mockResolvedValue({
    ok: true,
    provider: 'deepseek',
    fetchedAt: new Date().toISOString(),
    source: 'live',
    models: [
      { id: 'deepseek-v4-flash', ownedBy: 'deepseek' },
      { id: 'deepseek-chat', ownedBy: 'deepseek' },
      { id: 'mystery-model', ownedBy: 'deepseek' },
    ],
  })
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(ModelsSection, { provider: 'deepseek', loadModels, t })); roots.push(root) })
  const json = JSON.stringify(root.toJSON())
  expect(json).toContain('Input $0.15 · Output $0.60 per million tokens')
  expect(json).toContain('Pricing not catalogued')
})

it('renders the balance trend and low-balance warnings in settings', async () => {
  const loadBalance = vi.fn<BalanceTabInjected['loadBalance']>().mockResolvedValue({
    ok: true,
    provider: 'deepseek',
    fetchedAt: new Date().toISOString(),
    source: 'live',
    isAvailable: true,
    balanceInfos: [{ currency: 'USD', totalBalance: '3.50' }],
    history: [
      { fetchedAt: new Date(Date.now() - 7_200_000).toISOString(), isAvailable: true, balances: [{ currency: 'USD', totalBalance: '10.00' }] },
      { fetchedAt: new Date().toISOString(), isAvailable: true, balances: [{ currency: 'USD', totalBalance: '3.50' }] },
    ],
    lowBalance: [{ currency: 'USD', totalBalance: '3.50', amount: 5 }],
  })
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BalanceSection, { provider: 'deepseek', loadBalance, t })); roots.push(root) })
  const json = JSON.stringify(root.toJSON())
  expect(json).toContain('dsh-balance-sparkline')
  expect(json).toContain('Balance below threshold')
  expect(json).toContain('USD balance $3.50 is below $5.00')
})

it('flags a low balance in the composer dock', async () => {
  const lowBalance: BalanceApiResponse = { ok: true, fetchedAt: new Date().toISOString(), source: 'live', isAvailable: true, balanceInfos: [{ currency: 'USD', totalBalance: '3' }], lowBalance: [{ currency: 'USD', totalBalance: '3', amount: 5 }] }
  const loadBalance = vi.fn<BalanceDockInjected['loadBalance']>().mockResolvedValue(lowBalance)
  const selection = directory()
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BalanceDock, dockProps(selection, loadBalance))); roots.push(root) })
  expect(root.root.findByProps({ className: 'dsh-balance-dock-dot' }).props['data-low']).toBe('true')
  expect(root.root.findByProps({ className: 'dsh-balance-dock' }).props['aria-label']).toContain('Low balance')
})

function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  })
  return store
}

describe('display rate storage', () => {
  it('round-trips through localStorage and ignores invalid values', () => {
    const store = stubLocalStorage()
    expect(readStoredRate()).toBeNull()
    writeStoredRate(7.2)
    expect(store.get('dsh-balance:usd-to-cny')).toBe('7.2')
    expect(readStoredRate()).toBe(7.2)
    writeStoredRate(null)
    expect(readStoredRate()).toBeNull()
    store.set('dsh-balance:usd-to-cny', '0')
    expect(readStoredRate()).toBeNull()
    store.set('dsh-balance:usd-to-cny', 'abc')
    expect(readStoredRate()).toBeNull()
  })
})

it('drills from the session table into one session and back to the overview', async () => {
  const all = usage(10)
  if (!all.ok || all.scope !== 'all') throw new Error('invalid fixture')
  all.summary.bySession = [{ ...all.summary.totals, sessionId: 'session-a', title: 'Session A' }]
  const session: UsageApiResponse = {
    ok: true, scope: 'session', fetchedAt: new Date().toISOString(), source: 'live',
    session: { ...all.summary.totals, sessionId: 'session-a', title: 'Session A' },
    summary: all.summary,
    requests: [],
  }
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValueOnce(all).mockResolvedValueOnce(session).mockResolvedValue(all)
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingOverview, { loadUsage, t })); roots.push(root) })
  // Cross-component state updates need an async act flush (React 18 batching).
  await act(async () => { root.root.findAllByProps({ role: 'tab' })[2]!.props.onClick() })
  await act(async () => { root.root.findByProps({ className: 'dsh-billing-session-title dsh-billing-session-action' }).props.onClick() })
  expect(loadUsage).toHaveBeenCalledTimes(2)
  expect(loadUsage.mock.calls[1]?.[0]).toMatchObject({ scope: 'session', sessionId: 'session-a' })
  expect(JSON.stringify(root.toJSON())).toContain('Session usage details')
  await act(async () => { root.root.findByProps({ 'aria-label': 'Back to overview' }).props.onClick() })
  expect(loadUsage).toHaveBeenCalledTimes(3)
  expect(loadUsage.mock.calls[2]?.[0]).toMatchObject({ scope: 'all' })
})

it('offers JSON and CSV export buttons that survive a DOM-less environment', async () => {
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValue(usage(10))
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingOverview, { loadUsage, t })); roots.push(root) })
  const byText = (text: string) => root.root.findAllByProps({ className: 'dsh-balance-refresh' }).find(button => button.props.children === text)
  const json = byText('Export JSON')
  const csv = byText('Export CSV')
  expect(json).toBeDefined()
  expect(csv).toBeDefined()
  expect(json!.props.disabled).toBe(false)
  act(() => { json!.props.onClick(); csv!.props.onClick() })
})

it('applies a stored display rate and persists edits without a Host restart', async () => {
  const store = stubLocalStorage()
  store.set('dsh-balance:usd-to-cny', '7.2')
  const result = usage(10)
  if (!result.ok || result.scope !== 'all') throw new Error('invalid fixture')
  result.summary.totals = { ...result.summary.totals, pricedRequests: 1, unpricedRequests: 0, costUsd: 1, hasCompleteCnyTotal: true }
  const loadUsage = vi.fn<UsageTabInjected['loadUsage']>().mockResolvedValue(result)
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(BillingOverview, { loadUsage, t })); roots.push(root) })
  expect(JSON.stringify(root.toJSON())).toContain('¥7.20')
  act(() => root.root.findByProps({ 'aria-label': 'USD→CNY rate' }).props.onChange({ target: { value: '7.5' } }))
  expect(store.get('dsh-balance:usd-to-cny')).toBe('7.5')
  await act(async () => {})
  expect(JSON.stringify(root.toJSON())).toContain('¥7.50')
})

it('prefers Host-provided model prices over the bundled catalog', async () => {
  const loadModels = vi.fn<ModelsTabInjected['loadModels']>().mockResolvedValue({
    ok: true,
    provider: 'deepseek',
    fetchedAt: new Date().toISOString(),
    source: 'live',
    models: [{ id: 'deepseek-v4-flash', ownedBy: 'deepseek' }],
    prices: [{
      provider: 'deepseek', model: 'deepseek-v4-flash', effectiveFrom: '2026-01-01T00:00:00.000Z', pricingVersion: 'pricing-override',
      cacheHitUsdPerMillion: 0.001, cacheMissUsdPerMillion: 0.01, outputUsdPerMillion: 0.02,
    }],
  })
  let root!: ReactTestRenderer
  await act(async () => { root = create(createElement(ModelsSection, { provider: 'deepseek', loadModels, t })); roots.push(root) })
  const json = JSON.stringify(root.toJSON())
  expect(json).toContain('Input $0.01 · Output $0.02 per million tokens')
  expect(json).not.toContain('$0.22')
})
