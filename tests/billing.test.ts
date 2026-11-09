import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import {
  aggregateBilling,
  calculateRequestCost,
  effectivePrices,
  extractSessionUsage,
  findBillingPrice,
  normalizePricingOverrides,
  normalizeUsdToCny,
  resolveBillingPrice,
} from '../src/billing.ts'

const time = (value: string): number => Date.parse(value)

function event(type: string, data: unknown, seq: number, at: string): SessionEvent {
  return { type, data, seq, time: time(at) } as SessionEvent
}

function requestHeader(seq: number, at: string, provider = 'deepseek', model = 'deepseek-v4-flash'): SessionEvent {
  return event('request/header', {
    header: { config: { provider, model } },
    reason: seq === 0 ? 'initial' : 'change',
  }, seq, at)
}

function stepStart(seq: number, turn = 1, step = 0, at = '2026-08-17T00:00:00Z'): SessionEvent {
  return event('step/start', { turn, step }, seq, at)
}

function assistant(seq: number, usage: unknown, turn = 1, step = 0, at = '2026-08-17T00:00:01Z'): SessionEvent {
  return event('assistant/message', { turn, step, message: {}, ...(usage === undefined ? {} : { usage }) }, seq, at)
}

const inheritedEventCount = 0
const utcOptions = { timeZone: 'UTC' }

describe('billing price calculation', () => {
  it('splits uncached input, cache writes, cache hits, and output', () => {
    const price = resolveBillingPrice('deepseek', 'deepseek-v4-flash', time('2026-08-17T00:00:00Z'))
    expect(price).toBeDefined()
    expect(calculateRequestCost({ inputTokens: 1_000_000, cacheWriteTokens: 1_000_000, cacheReadTokens: 1_000_000, outputTokens: 1_000_000 }, price!, time('2026-08-17T00:00:00Z'))).toBe(1.107)
  })

  it('doubles the price during Beijing peak hours', () => {
    const price = resolveBillingPrice('deepseek', 'deepseek-v4-flash', time('2026-08-17T00:00:00Z'))!
    const usage = { inputTokens: 1_000_000, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 1_000_000 }
    expect(calculateRequestCost(usage, price, time('2026-08-17T00:00:00Z'))).toBe(0.88)
    expect(calculateRequestCost(usage, price, time('2026-08-17T01:00:00Z'))).toBe(1.76)
  })

  it('maps legacy aliases and rejects unknown providers or models', () => {
    expect(resolveBillingPrice('deepseek', 'deepseek-chat', time('2026-08-16T00:00:00Z'))?.pricingVersion).toBe('deepseek-legacy')
    expect(resolveBillingPrice('deepseek', 'deepseek-chat', time('2026-08-17T00:00:00Z'))?.model).toBe('deepseek-v4-flash')
    expect(resolveBillingPrice('other', 'deepseek-v4-flash', time('2026-08-17T00:00:00Z'))).toBeUndefined()
    expect(resolveBillingPrice('deepseek', 'not-a-model', time('2026-08-17T00:00:00Z'))).toBeUndefined()
  })
})

describe('extractSessionUsage', () => {
  it('matches request headers to assistant usage and preserves unknown billing reasons', () => {
    const events = [
      requestHeader(0, '2026-08-17T00:00:00Z'),
      stepStart(1),
      assistant(2, { inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 3 }),
      requestHeader(3, '2026-08-17T01:00:00Z', 'unknown-provider', 'model-x'),
      stepStart(4, 2, 0, '2026-08-17T01:00:00Z'),
      assistant(5, { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, 2, 0, '2026-08-17T01:00:01Z'),
      stepStart(6, 3, 0, '2026-08-17T02:00:00Z'),
      assistant(7, undefined, 3, 0, '2026-08-17T02:00:01Z'),
    ]
    const records = extractSessionUsage('session-a', inheritedEventCount, events, utcOptions)
    expect(records).toHaveLength(3)
    expect(records[0]).toMatchObject({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 3, costUsd: 0.000006174, billingStatus: 'priced' })
    expect(records[1]).toMatchObject({ costUsd: null, unknownReason: 'unknown-provider', billingStatus: 'unpriced' })
    expect(records[2]).toMatchObject({ costUsd: null, unknownReason: 'missing-usage', billingStatus: 'unpriced' })
  })

  it('skips inherited fork events before inheritedEventCount while retaining their request header', () => {
    const events = [
      requestHeader(0, '2026-08-16T00:00:00Z'),
      stepStart(1, 1, 0, '2026-08-16T00:00:00Z'),
      assistant(2, { inputTokens: 1_000_000, outputTokens: 1_000_000 }, 1, 0, '2026-08-16T00:00:01Z'),
      stepStart(3, 2, 0, '2026-08-17T00:00:00Z'),
      assistant(4, { inputTokens: 1, outputTokens: 1 }, 2, 0, '2026-08-17T00:00:01Z'),
    ]
    const records = extractSessionUsage('fork', 3, events, utcOptions)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ turn: 2, provider: 'deepseek', model: 'deepseek-v4-flash' })
  })

  it('groups dates in the requested browser timezone', () => {
    const events = [
      requestHeader(0, '2026-08-17T23:30:00Z'),
      stepStart(1, 1, 0, '2026-08-17T23:30:00Z'),
      assistant(2, { inputTokens: 1, outputTokens: 1 }, 1, 0, '2026-08-17T23:30:01Z'),
    ]
    expect(extractSessionUsage('tz', inheritedEventCount, events, { timeZone: 'Asia/Shanghai' })[0]?.time).toBe('2026-08-17T23:30:00.000Z')
    const summary = aggregateBilling([{ sessionId: 'tz', title: 'TZ', inheritedEventCount, events }], { timeZone: 'Asia/Shanghai' }).summary
    expect(summary.byDay[0]?.date).toBe('2026-08-18')
  })
})

describe('aggregateBilling', () => {
  it('aggregates multiple sessions and converts to CNY only when configured', () => {
    const firstEvents = [requestHeader(0, '2026-08-17T00:00:00Z'), stepStart(1), assistant(2, { inputTokens: 1_000_000, outputTokens: 0 })]
    const secondEvents = [requestHeader(0, '2026-08-17T00:00:00Z', 'deepseek', 'deepseek-v4-pro'), stepStart(1), assistant(2, { inputTokens: 0, outputTokens: 1_000_000 })]
    const summary = aggregateBilling([
      { sessionId: 'one', title: 'One', inheritedEventCount, events: firstEvents },
      { sessionId: 'two', title: 'Two', inheritedEventCount, events: secondEvents },
    ], { ...utcOptions, usdToCny: 7 }).summary
    expect(summary.totals.requests).toBe(2)
    expect(summary.totals.costUsd).toBe(2.2)
    expect(summary.totals.costCny).toBe(15.4)
    expect(summary.bySession).toHaveLength(2)
    expect(summary.byModel).toHaveLength(2)
    expect(summary.bySession.reduce((total, item) => total + item.costUsd, 0)).toBe(summary.totals.costUsd)
  })

  it('classifies known zero-cost usage as free instead of unpriced', () => {
    const events = [requestHeader(0, '2026-08-17T00:00:00Z'), stepStart(1), assistant(2, { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })]
    const aggregate = aggregateBilling([{ sessionId: 'free', title: 'Free', inheritedEventCount, events }], { ...utcOptions, usdToCny: 7 })
    expect(aggregate.requestsBySession.get('free')?.[0]).toMatchObject({ billingStatus: 'free', costUsd: 0 })
    expect(aggregate.summary.totals).toMatchObject({ requests: 1, pricedRequests: 0, freeRequests: 1, unpricedRequests: 0, hasCompleteCnyTotal: true })
  })

  it('describes native-only versus converted CNY totals without overclaiming completeness', () => {
    const at = '2026-10-01T00:00:00Z'
    const sources = [
      { sessionId: 'usd', title: 'USD', inheritedEventCount, events: [requestHeader(0, at), stepStart(1, 1, 0, at), assistant(2, { inputTokens: 1_000_000, outputTokens: 0 })] },
      { sessionId: 'cny', title: 'CNY', inheritedEventCount, events: [requestHeader(0, at, 'stepfun', 'step-5-preview'), stepStart(1, 1, 0, at), assistant(2, { inputTokens: 1_000_000, outputTokens: 0 })] },
    ]
    const native = aggregateBilling(sources, utcOptions).summary
    expect(native.cnyTotalMode).toBe('native-only')
    expect(native.totals.hasCompleteCnyTotal).toBe(false)
    const converted = aggregateBilling(sources, { ...utcOptions, usdToCny: 7 }).summary
    expect(converted.cnyTotalMode).toBe('converted')
    expect(converted.totals.hasCompleteCnyTotal).toBe(true)
  })

  it('accepts only a positive finite fixed USD to CNY rate', () => {
    expect(normalizeUsdToCny(undefined)).toBeUndefined()
    expect(normalizeUsdToCny(7.2)).toBe(7.2)
    expect(normalizeUsdToCny(0)).toBeUndefined()
    expect(normalizeUsdToCny(-1)).toBeUndefined()
    expect(normalizeUsdToCny(Number.NaN)).toBeUndefined()
  })
})

describe('provider and model switching', () => {
  it('uses headers written after step/start and message source when a call finishes', () => {
    const events = [
      requestHeader(0, '2026-08-17T00:00:00Z'), stepStart(1),
      requestHeader(2, '2026-08-17T00:00:01Z', 'StepFun', 'step-3.5-flash'),
      assistant(3, { inputTokens: 10, outputTokens: 5 }),
      stepStart(4, 2),
      event('assistant/message', { turn: 2, step: 0, message: { source: { provider: 'other-provider', model: 'deepseek-v4-flash' } }, usage: { inputTokens: 20, outputTokens: 2 } }, 5, '2026-08-17T00:00:10Z'),
    ]
    const records = extractSessionUsage('switch', inheritedEventCount, events, utcOptions)
    expect(records[0]).toMatchObject({ provider: 'stepfun', model: 'step-3.5-flash', costCny: 0.0000175, costUsd: null })
    expect(records[0]?.unknownReason).toBeUndefined()
    expect(records[1]).toMatchObject({ provider: 'other-provider', model: 'deepseek-v4-flash', unknownReason: 'unknown-provider', costUsd: null })
    expect(extractSessionUsage('switch', inheritedEventCount, events, { ...utcOptions, provider: 'other-provider' })).toEqual([records[1]])
  })

  it('dates later requests by their own start instead of a reused header', () => {
    const events = [requestHeader(0, '2026-08-17T00:00:00Z', 'DEEPSEEK'), stepStart(1), assistant(2, { inputTokens: 1_000_000, outputTokens: 0 }),
      stepStart(3, 2, 0, '2026-08-18T01:00:00Z'), assistant(4, { inputTokens: 1_000_000, outputTokens: 0 }, 2, 0, '2026-08-18T01:00:01Z')]
    const aggregate = aggregateBilling([{ sessionId: 'a', title: 'A', inheritedEventCount, events }], utcOptions)
    expect(aggregate.summary.byDay.map(day => [day.date, day.costUsd])).toEqual([['2026-08-18', 0.44], ['2026-08-17', 0.22]])
    expect(aggregate.summary.byModel).toHaveLength(1)
    expect(aggregate.summary.byModel[0]?.provider).toBe('deepseek')
    expect(extractSessionUsage('a', inheritedEventCount, events, { ...utcOptions, from: '2026-08-18' })).toHaveLength(1)
  })

  it('keeps provider totals separate even for the same model and filters all breakdowns consistently', () => {
    const events = [requestHeader(0, '2026-08-17T00:00:00Z'), stepStart(1), assistant(2, { inputTokens: 100, outputTokens: 5, cacheReadTokens: 20, cacheWriteTokens: 10 }),
      stepStart(3, 2), requestHeader(4, '2026-08-17T00:00:05Z', 'STEPFUN'), assistant(5, { inputTokens: 7, outputTokens: 8 }, 2)]
    const source = { sessionId: 'a', title: 'A', inheritedEventCount, events }
    expect(aggregateBilling([source], utcOptions).summary.byModel).toHaveLength(2)
    const { summary, requestsBySession } = aggregateBilling([source], { ...utcOptions, provider: 'stepfun' })
    expect(summary.totals).toMatchObject({ requests: 1, inputTokens: 7, outputTokens: 8, unpricedRequests: 1 })
    expect(summary.byModel).toHaveLength(1)
    expect(summary.byDay[0]?.requests).toBe(1)
    expect(summary.bySession[0]?.requests).toBe(1)
    expect(requestsBySession.get('a')).toHaveLength(1)
  })
})

it('groups official and legacy DeepSeek routes together without assigning an unverified model price', () => {
  const events = [requestHeader(0, '2026-08-17T00:00:00Z', 'deepseek'), stepStart(1), assistant(2, { inputTokens: 100, outputTokens: 5 }),
    stepStart(3, 2), requestHeader(4, '2026-08-17T00:00:05Z', 'deepseek-official'), assistant(5, { inputTokens: 7, outputTokens: 8 }, 2),
    stepStart(6, 3), requestHeader(7, '2026-08-17T00:00:10Z', 'DEEPSEEK-OFFICIAL', 'deepseek-flash'), assistant(8, { inputTokens: 3, outputTokens: 4 }, 3)]
  const source = { sessionId: 'a', title: 'A', inheritedEventCount, events }
  const legacy = aggregateBilling([source], { ...utcOptions, provider: 'deepseek' })
  const official = aggregateBilling([source], { ...utcOptions, provider: 'deepseek-official' })
  expect(official.summary).toEqual(legacy.summary)
  expect(official.summary.byModel).toHaveLength(2)
  expect(official.summary.totals).toMatchObject({ requests: 3, pricedRequests: 2, unpricedRequests: 1 })
  expect(official.requestsBySession.get('a')?.[2]).toMatchObject({ provider: 'deepseek', model: 'deepseek-flash', costUsd: null, unknownReason: 'unknown-model' })
})


describe('Harness attempt settlements and cross-session totals', () => {
  const sample = (inputTokens: number) => ({ type: 'chunk', time: time('2026-08-17T00:00:01Z'), chunk: { type: 'usage', usage: { inputTokens, outputTokens: 2 } } })

  it('counts retries separately, uses the final stream sample, and replaces repeated settlements', () => {
    const events = [requestHeader(0, '2026-08-17T00:00:00Z'), stepStart(1),
      event('assistant/attempt', { turn: 1, step: 0, stream: [sample(3), sample(10)] }, 2, '2026-08-17T00:00:01Z'),
      event('llm/retry-started', { turn: 1, step: 0 }, 3, '2026-08-17T00:00:02Z'),
      event('assistant/message', { turn: 1, step: 0, message: {}, stream: [sample(20)] }, 4, '2026-08-17T00:00:03Z'),
      event('assistant/message', { turn: 1, step: 0, message: {}, stream: [sample(99)], usage: { inputTokens: 30, outputTokens: 2 } }, 5, '2026-08-17T00:00:04Z'),
    ]
    const records = extractSessionUsage('one', 0, events, utcOptions)
    expect(records.map(record => [record.seq, record.inputTokens])).toEqual([[2, 10], [5, 30]])
    expect(records[1]?.time).toBe('2026-08-17T00:00:02.000Z')
    const summary = aggregateBilling([{ sessionId: 'one', title: 'One', inheritedEventCount: 0, events }], utcOptions).summary
    expect(summary.totals).toMatchObject({ requests: 2, inputTokens: 40, outputTokens: 4, pricedRequests: 2 })
  })

  it('filters only after replacing a settlement with the actual provider', () => {
    const events = [requestHeader(0, '2026-08-17T00:00:00Z'), stepStart(1),
      event('assistant/attempt', { turn: 1, step: 0, stream: [sample(10)] }, 2, '2026-08-17T00:00:01Z'),
      event('assistant/message', { turn: 1, step: 0, message: { source: { provider: 'StepFun', model: 'step-model' } }, usage: { inputTokens: 20, outputTokens: 2 } }, 3, '2026-08-17T00:00:02Z'),
    ]
    expect(extractSessionUsage('one', 0, events, { ...utcOptions, provider: 'deepseek' })).toEqual([])
    expect(extractSessionUsage('one', 0, events, { ...utcOptions, provider: 'stepfun' })).toHaveLength(1)
  })

  it('keeps original, fork, and independent conversations additive across every breakdown', () => {
    const parent = [requestHeader(0, '2026-08-17T00:00:00Z'), stepStart(1), assistant(2, { inputTokens: 10, outputTokens: 2 })]
    const fork = [...parent, stepStart(3, 2), requestHeader(4, '2026-08-17T00:00:05Z', 'StepFun', 'step-model'), assistant(5, { inputTokens: 20, outputTokens: 3 }, 2)]
    const sources = [
      { sessionId: 'parent', title: 'Same title', inheritedEventCount: 0, events: parent },
      { sessionId: 'fork', title: 'Same title', inheritedEventCount: parent.length, events: fork },
      { sessionId: 'other', title: 'Same title', inheritedEventCount: 0, events: parent },
    ]
    const { summary } = aggregateBilling(sources, utcOptions)
    expect(summary.totals).toMatchObject({ requests: 3, inputTokens: 40, outputTokens: 7, pricedRequests: 2, unpricedRequests: 1 })
    expect(summary.byProvider.map(row => [row.provider, row.requests])).toEqual([['deepseek', 2], ['stepfun', 1]])
    for (const rows of [summary.byProvider, summary.byModel, summary.bySession, summary.byDay, summary.byWeekdayHour]) {
      expect(rows.reduce((sum, row) => sum + row.requests, 0)).toBe(summary.totals.requests)
      expect(rows.reduce((sum, row) => sum + row.inputTokens, 0)).toBe(summary.totals.inputTokens)
      expect(rows.reduce((sum, row) => sum + row.costUsd, 0)).toBeCloseTo(summary.totals.costUsd, 12)
    }
    expect(summary.bySession).toHaveLength(3)
  })
})


describe('activity punchcard', () => {
  it('groups requests by the browser timezone weekday/hour and applies provider/date filters', () => {
    const sources = [
      { sessionId: 'one', title: 'One', inheritedEventCount: 0, events: [requestHeader(0, '2026-09-27T16:30:00Z'), stepStart(1, 1, 0, '2026-09-27T16:30:00Z'), assistant(2, { inputTokens: 10, outputTokens: 2 }, 1, 0, '2026-09-27T16:30:01Z')] },
      { sessionId: 'two', title: 'Two', inheritedEventCount: 0, events: [requestHeader(0, '2026-09-27T16:45:00Z', 'StepFun', 'step-model'), stepStart(1, 1, 0, '2026-09-27T16:45:00Z'), assistant(2, { inputTokens: 20, outputTokens: 3 }, 1, 0, '2026-09-27T16:45:01Z')] },
    ]
    const summary = aggregateBilling(sources, { timeZone: 'Asia/Shanghai' }).summary
    expect(summary.byWeekdayHour).toHaveLength(1)
    expect(summary.byWeekdayHour[0]).toMatchObject({ weekday: 1, hour: 0, requests: 2, inputTokens: 30, outputTokens: 5 })
    expect(aggregateBilling(sources, utcOptions).summary.byWeekdayHour[0]).toMatchObject({ weekday: 0, hour: 16 })
    expect(aggregateBilling(sources, { timeZone: 'Asia/Shanghai', provider: 'deepseek', from: '2026-09-28', to: '2026-09-28' }).summary.byWeekdayHour[0]).toMatchObject({ weekday: 1, hour: 0, requests: 1 })
    expect(aggregateBilling(sources, { timeZone: 'Asia/Shanghai', to: '2026-09-27' }).summary.byWeekdayHour).toEqual([])
  })

  it('combines both occurrences of a DST repeated hour without dropping requests', () => {
    const events = [requestHeader(0, '2026-11-01T05:15:00Z'), stepStart(1, 1, 0, '2026-11-01T05:15:00Z'), assistant(2, { inputTokens: 1, outputTokens: 1 }),
      stepStart(3, 2, 0, '2026-11-01T06:15:00Z'), assistant(4, { inputTokens: 2, outputTokens: 1 }, 2)]
    const summary = aggregateBilling([{ sessionId: 'dst', title: 'DST', inheritedEventCount: 0, events }], { timeZone: 'America/New_York' }).summary
    expect(summary.byWeekdayHour).toHaveLength(1)
    expect(summary.byWeekdayHour[0]).toMatchObject({ weekday: 0, hour: 1, requests: 2, inputTokens: 3 })
    expect(summary.byWeekdayHour.reduce((sum, row) => sum + row.requests, 0)).toBe(summary.totals.requests)
  })
})

describe('native StepFun CNY billing', () => {
  it('prices the screenshot tokens once at official rates and never applies DeepSeek peak multipliers', () => {
    const at = time('2026-09-29T02:22:19Z')
    const price = resolveBillingPrice('StepFun', 'step-5-preview', at)!
    expect(price.currency).toBe('CNY')
    const usage = { inputTokens: 452_720, outputTokens: 54_176, cacheReadTokens: 6_654_232, cacheWriteTokens: 0 }
    expect(calculateRequestCost(usage, price, at)).toBe(6.5815412)
    expect(calculateRequestCost(usage, price, time('2026-09-29T00:00:00Z'))).toBe(6.5815412)
    expect(calculateRequestCost({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 1_000_000 }, price, at)).toBe(7)
    expect(resolveBillingPrice('other', 'step-5-preview', at)).toBeUndefined()
    expect(resolveBillingPrice('stepfun', 'future-step-model', at)).toBeUndefined()
  })

  it('keeps USD and native CNY separate across every breakdown, converting only with a configured rate', () => {
    const at = '2026-09-29T00:00:00Z'
    const sources = [
      { sessionId: 'usd', title: 'USD', inheritedEventCount: 0, events: [requestHeader(0, at), stepStart(1, 1, 0, at), assistant(2, { inputTokens: 1_000_000, outputTokens: 0 })] },
      { sessionId: 'cny', title: 'CNY', inheritedEventCount: 0, events: [requestHeader(0, at, 'STEPFUN', 'step-5-preview'), stepStart(1, 1, 0, at), assistant(2, { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 })] },
    ]
    const { summary, requestsBySession } = aggregateBilling(sources, utcOptions)
    expect(summary.totals).toMatchObject({ requests: 2, pricedRequests: 2, unpricedRequests: 0, cnyPricedRequests: 1, costUsd: 0.22, nativeCostCny: 27.35, costCny: 27.35 })
    expect(requestsBySession.get('cny')?.[0]).toMatchObject({ costUsd: null, costCny: 27.35 })
    for (const rows of [summary.byProvider, summary.byModel, summary.bySession, summary.byDay, summary.byWeekdayHour]) {
      expect(rows.reduce((sum, row) => sum + row.nativeCostCny, 0)).toBe(27.35)
      expect(rows.reduce((sum, row) => sum + row.pricedRequests, 0)).toBe(2)
    }
    expect(aggregateBilling(sources, { ...utcOptions, usdToCny: 7 }).summary.totals.costCny).toBe(28.89)
    expect(aggregateBilling(sources, { ...utcOptions, provider: 'stepfun' }).summary.totals).toMatchObject({ costUsd: 0, costCny: 27.35, pricedRequests: 1 })
  })
})

describe('Tokener usage', () => {
  const at = '2026-11-03T01:00:00Z' // Beijing peak hours must not change gateway rates.
  const eventsFor = (provider: string, model: string, usage: unknown) => [
    requestHeader(0, at, provider, model), stepStart(1, 1, 0, at), assistant(2, usage, 1, 0, at),
  ]

  it('uses Tokener catalog prices, not the model vendor prices or peak multiplier', () => {
    const price = resolveBillingPrice('TOKENER.AI', 'deepseek-v4-pro', time(at))!
    expect(price).toMatchObject({ provider: 'tokener', pricingVersion: 'tokener-reference-2026-11-03' })
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 }
    expect(calculateRequestCost(usage, price, time(at))).toBe(5.324)
    expect(calculateRequestCost(usage, price, time('2026-11-03T00:00:00Z'))).toBe(5.324)
    expect(resolveBillingPrice('tokener', 'deepseek-chat', time(at))).toBeUndefined()
  })

  it('aggregates aliases, preserves disjoint cached tokens, and supports provider/date filtering', () => {
    const sources = ['Tokener', 'TOKENER.AI', 'deepseek'].map((provider, i) => ({
      sessionId: String(i), title: `Session ${i}`, inheritedEventCount: 0,
      events: eventsFor(provider, 'deepseek-flash', { inputTokens: 600, cacheReadTokens: 400, outputTokens: 100 }),
    }))
    // DSH has already subtracted cache-read tokens from prompt tokens: 600 + 400 = 1000.
    const { summary, requestsBySession } = aggregateBilling(sources, { timeZone: 'Asia/Shanghai', provider: ' tokener.ai ', from: '2026-11-03', to: '2026-11-03', usdToCny: 7 })
    expect(summary.totals).toMatchObject({ requests: 2, pricedRequests: 2, inputTokens: 1200, cacheReadTokens: 800, outputTokens: 200, costUsd: 0.0006048, costCny: 0.0042336 })
    expect(summary.byProvider).toHaveLength(1)
    expect(summary.byProvider[0]?.provider).toBe('tokener')
    expect(summary.bySession).toHaveLength(2)
    expect(summary.byModel[0]?.model).toBe('deepseek-flash')
    expect(summary.byDay[0]?.date).toBe('2026-11-03')
    expect(summary.byWeekdayHour[0]).toMatchObject({ weekday: 2, hour: 9, requests: 2 })
    expect(requestsBySession.get('0')?.[0]).toMatchObject({ billingStatus: 'priced', costUsd: 0.0003024 })
    expect(aggregateBilling(sources, { timeZone: 'UTC', from: '2026-11-04' }).summary.totals.requests).toBe(0)
  })

  it('preserves unknown models and unpublished cache writes as unpriced, not free', () => {
    const unknown = extractSessionUsage('unknown', 0, eventsFor('tokener', 'private-model', { inputTokens: 10, outputTokens: 2, cacheReadTokens: 5 }), utcOptions)
    expect(unknown[0]).toMatchObject({ provider: 'tokener', inputTokens: 10, cacheReadTokens: 5, costUsd: null, billingStatus: 'unpriced', unknownReason: 'unknown-model' })
    const writes = extractSessionUsage('writes', 0, eventsFor('tokener', 'claude-sonnet-4-6', { inputTokens: 10, outputTokens: 2, cacheWriteTokens: 100 }), utcOptions)
    expect(writes[0]).toMatchObject({ cacheWriteTokens: 100, costUsd: null, billingStatus: 'unpriced', unknownReason: 'unknown-cache-write-price' })
    expect(extractSessionUsage('missing', 0, eventsFor('tokener', 'gpt-5.4', undefined), utcOptions)[0]?.unknownReason).toBe('missing-usage')
  })
})

describe('findBillingPrice', () => {
  it('returns the latest effective schedule for a known model', () => {
    // API model names on the legacy schedule display their current V4 rates.
    expect(findBillingPrice('deepseek', 'deepseek-chat')).toMatchObject({ model: 'deepseek-v4-flash', pricingVersion: 'deepseek-v4-2026-08-17' })
    expect(findBillingPrice('deepseek', 'deepseek-reasoner')).toMatchObject({ model: 'deepseek-v4-flash' })
    expect(findBillingPrice('StepFun', 'step-5-preview')).toMatchObject({ provider: 'stepfun', currency: 'CNY', outputCnyPerMillion: 20 })
    expect(findBillingPrice('tokener.ai', 'claude-opus-5')).toMatchObject({ provider: 'tokener', outputUsdPerMillion: 25 })
  })

  it('returns undefined for unknown providers or models', () => {
    expect(findBillingPrice('deepseek', 'not-a-model')).toBeUndefined()
    expect(findBillingPrice('unknown', 'deepseek-v4-flash')).toBeUndefined()
  })
})

describe('pricing overrides', () => {
  const usd = { provider: 'deepseek', model: 'deepseek-v4-flash', cacheHitUsdPerMillion: 0.001, cacheMissUsdPerMillion: 0.01, outputUsdPerMillion: 0.02 }
  const cny = { provider: 'StepFun', model: 'step-5-preview', cacheHitCnyPerMillion: 0.1, cacheMissCnyPerMillion: 1, outputCnyPerMillion: 3 }

  it('normalizes complete USD and CNY rows and rejects incomplete ones', () => {
    expect(normalizePricingOverrides([usd, cny])).toMatchObject([
      { provider: 'deepseek', model: 'deepseek-v4-flash', pricingVersion: 'pricing-override', effectiveFrom: '1970-01-01T00:00:00.000Z' },
      { provider: 'stepfun', model: 'step-5-preview', currency: 'CNY', outputCnyPerMillion: 3 },
    ])
    expect(normalizePricingOverrides(undefined)).toEqual([])
    expect(() => normalizePricingOverrides([{ provider: 'deepseek', model: 'deepseek-v4-flash', cacheHitUsdPerMillion: 0.001, cacheMissUsdPerMillion: 0.01 }])).toThrow('完整')
    expect(() => normalizePricingOverrides([{ ...usd, cacheHitCnyPerMillion: 1 }])).toThrow('完整')
    expect(() => normalizePricingOverrides([{ provider: 'unknown', model: 'm', cacheHitUsdPerMillion: 1, cacheMissUsdPerMillion: 1, outputUsdPerMillion: 1 }])).toThrow('未知提供方')
    expect(() => normalizePricingOverrides([{ ...usd, model: ' ' }])).toThrow('模型 ID')
    expect(() => normalizePricingOverrides([{ ...usd, effectiveFrom: 'not-a-date' }])).toThrow('effectiveFrom')
  })

  it('prefers overrides in resolveBillingPrice, honoring effectiveFrom', () => {
    const overrides = normalizePricingOverrides([{ ...usd, effectiveFrom: '2027-01-01T00:00:00Z' }])
    expect(resolveBillingPrice('deepseek', 'deepseek-v4-flash', time('2027-06-01T00:00:00Z'), overrides)).toMatchObject({
      cacheMissUsdPerMillion: 0.01,
      pricingVersion: 'pricing-override',
    })
    // Before the override takes effect the built-in schedule still applies.
    expect(resolveBillingPrice('deepseek', 'deepseek-v4-flash', time('2026-09-01T00:00:00Z'), overrides)).toMatchObject({ pricingVersion: 'deepseek-v4-2026-08-17' })
    // The latest effective override wins.
    const later = normalizePricingOverrides([usd, { ...usd, effectiveFrom: '2026-06-01T00:00:00Z', outputUsdPerMillion: 0.05 }])
    expect(resolveBillingPrice('deepseek', 'deepseek-v4-flash', time('2026-07-01T00:00:00Z'), later)).toMatchObject({ outputUsdPerMillion: 0.05 })
  })

  it('builds the effective catalog with overrides replacing built-in rows', () => {
    const overrides = normalizePricingOverrides([usd])
    const prices = effectivePrices('deepseek', overrides)
    const flash = prices.find(price => price.model === 'deepseek-v4-flash')
    expect(flash).toMatchObject({ cacheMissUsdPerMillion: 0.01 })
    // Built-in rows for other models survive, and each model appears once.
    expect(prices.filter(price => price.model === 'deepseek-v4-flash')).toHaveLength(1)
    expect(prices.map(price => price.model)).toContain('deepseek-v4-pro')
    expect(effectivePrices('deepseek')).toContainEqual(expect.objectContaining({ model: 'deepseek-v4-flash', cacheMissUsdPerMillion: 0.22 }))
  })

  it('prices extracted requests with overrides and labels their version', () => {
    const overrides = normalizePricingOverrides([{ provider: 'deepseek', model: 'deepseek-v4-flash', cacheHitUsdPerMillion: 0, cacheMissUsdPerMillion: 1, outputUsdPerMillion: 1 }])
    const events = [
      requestHeader(0, '2026-08-17T00:00:00Z'),
      stepStart(1),
      assistant(2, { inputTokens: 1_000_000, outputTokens: 1_000_000 }, 1, 0, '2026-08-17T00:00:01Z'),
    ]
    const [record] = extractSessionUsage('s', 0, events, { timeZone: 'UTC', pricingOverrides: overrides })
    expect(record?.costUsd).toBe(2)
    expect(record?.pricingVersion).toBe('pricing-override')
    expect(record?.billingStatus).toBe('priced')
  })

  it('threads overrides through aggregateBilling', () => {
    const overrides = normalizePricingOverrides([{ provider: 'deepseek', model: 'deepseek-v4-flash', cacheHitUsdPerMillion: 0, cacheMissUsdPerMillion: 2, outputUsdPerMillion: 0 }])
    const events = [
      requestHeader(0, '2026-08-17T00:00:00Z'),
      stepStart(1),
      assistant(2, { inputTokens: 1_000_000, outputTokens: 0 }, 1, 0, '2026-08-17T00:00:01Z'),
    ]
    const { summary } = aggregateBilling([{ sessionId: 's', title: 'S', inheritedEventCount: 0, events }], { timeZone: 'UTC', pricingOverrides: overrides })
    expect(summary.totals.costUsd).toBe(2)
  })
})
