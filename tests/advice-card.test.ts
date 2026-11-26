import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCostParts } from '../src/client/AdviceCard.tsx'
import { UsagePage } from '../src/client/UsagePage.tsx'
import type { UsagePageProps } from '../src/client/UsagePage.tsx'
import { en } from '../src/client/locales.ts'

const t: UsagePageProps['t'] = (key, values) => Object.entries(values ?? {}).reduce(
  (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), (en as Record<string, string>)[key] ?? key,
)

describe('advice card layout', () => {
  beforeEach(() => { vi.stubGlobal('window', globalThis) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('splits a cost into separately wrapping amounts', () => {
    const parts = formatCostParts({ costUsd: 0.5, combinedCny: 3.6 }, 'en', 7.2, t)
    expect(parts).toHaveLength(2)
    expect(parts[1]).toContain(t('billing.fixedRate'))
    expect(formatCostParts({ costUsd: null, combinedCny: null }, 'en', null, t)).toEqual([t('advice.noEstimate')])
  })

  it('UsagePage forwards the injected advice loader to the usage overview', () => {
    const loadUsage = vi.fn(() => new Promise<never>(() => {}))
    const loadAdvice = vi.fn(() => new Promise<never>(() => {}))
    let root!: ReturnType<typeof create>
    act(() => { root = create(createElement(UsagePage as never, { t, loadUsage, loadAdvice })) })
    const overview = root.root.findAll(node => typeof node.type === 'function' && node.type.name === 'BillingOverview')[0]
    expect(overview?.props.loadAdvice).toBe(loadAdvice)
    act(() => { root.unmount() })
  })
})
