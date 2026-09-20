import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import {
  aggregateBilling,
  calculateRequestCost,
  extractSessionUsage,
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

const header = { seedLength: 0 }
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
    const records = extractSessionUsage('session-a', header, events, utcOptions)
    expect(records).toHaveLength(3)
    expect(records[0]).toMatchObject({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 2, cacheWriteTokens: 3, costUsd: 0.000006174 })
    expect(records[1]).toMatchObject({ costUsd: null, unknownReason: 'unknown-provider' })
    expect(records[2]).toMatchObject({ costUsd: null, unknownReason: 'missing-usage' })
  })

  it('skips inherited fork events before seedLength while retaining their request header', () => {
    const events = [
      requestHeader(0, '2026-08-16T00:00:00Z'),
      stepStart(1, 1, 0, '2026-08-16T00:00:00Z'),
      assistant(2, { inputTokens: 1_000_000, outputTokens: 1_000_000 }, 1, 0, '2026-08-16T00:00:01Z'),
      stepStart(3, 2, 0, '2026-08-17T00:00:00Z'),
      assistant(4, { inputTokens: 1, outputTokens: 1 }, 2, 0, '2026-08-17T00:00:01Z'),
    ]
    const records = extractSessionUsage('fork', { seedLength: 3 }, events, utcOptions)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ turn: 2, provider: 'deepseek', model: 'deepseek-v4-flash' })
  })

  it('groups dates in the requested browser timezone', () => {
    const events = [
      requestHeader(0, '2026-08-17T23:30:00Z'),
      stepStart(1, 1, 0, '2026-08-17T23:30:00Z'),
      assistant(2, { inputTokens: 1, outputTokens: 1 }, 1, 0, '2026-08-17T23:30:01Z'),
    ]
    expect(extractSessionUsage('tz', header, events, { timeZone: 'Asia/Shanghai' })[0]?.time).toBe('2026-08-17T23:30:00.000Z')
    const summary = aggregateBilling([{ sessionId: 'tz', title: 'TZ', header, events }], { timeZone: 'Asia/Shanghai' }).summary
    expect(summary.byDay[0]?.date).toBe('2026-08-18')
  })
})

describe('aggregateBilling', () => {
  it('aggregates multiple sessions and converts to CNY only when configured', () => {
    const firstEvents = [requestHeader(0, '2026-08-17T00:00:00Z'), stepStart(1), assistant(2, { inputTokens: 1_000_000, outputTokens: 0 })]
    const secondEvents = [requestHeader(0, '2026-08-17T00:00:00Z', 'deepseek', 'deepseek-v4-pro'), stepStart(1), assistant(2, { inputTokens: 0, outputTokens: 1_000_000 })]
    const summary = aggregateBilling([
      { sessionId: 'one', title: 'One', header, events: firstEvents },
      { sessionId: 'two', title: 'Two', header, events: secondEvents },
    ], { ...utcOptions, usdToCny: 7 }).summary
    expect(summary.totals.requests).toBe(2)
    expect(summary.totals.costUsd).toBe(2.2)
    expect(summary.totals.costCny).toBe(15.4)
    expect(summary.bySession).toHaveLength(2)
    expect(summary.byModel).toHaveLength(2)
    expect(summary.bySession.reduce((total, item) => total + item.costUsd, 0)).toBe(summary.totals.costUsd)
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
      event('assistant/message', { turn: 2, step: 0, message: { source: { provider: 'ToKeNeR', model: 'deepseek-v4-flash' } }, usage: { inputTokens: 20, outputTokens: 2 } }, 5, '2026-08-17T00:00:10Z'),
    ]
    const records = extractSessionUsage('switch', header, events, utcOptions)
    expect(records[0]).toMatchObject({ provider: 'stepfun', model: 'step-3.5-flash', unknownReason: 'unknown-model', costUsd: null })
    expect(records[1]).toMatchObject({ provider: 'tokener', model: 'deepseek-v4-flash', unknownReason: 'unknown-model', costUsd: null })
    expect(extractSessionUsage('switch', header, events, { ...utcOptions, provider: 'TOKENER' })).toEqual([records[1]])
  })

  it('dates later requests by their own start instead of a reused header', () => {
    const events = [requestHeader(0, '2026-08-17T00:00:00Z', 'DEEPSEEK'), stepStart(1), assistant(2, { inputTokens: 1_000_000, outputTokens: 0 }),
      stepStart(3, 2, 0, '2026-08-18T01:00:00Z'), assistant(4, { inputTokens: 1_000_000, outputTokens: 0 }, 2, 0, '2026-08-18T01:00:01Z')]
    const aggregate = aggregateBilling([{ sessionId: 'a', title: 'A', header, events }], utcOptions)
    expect(aggregate.summary.byDay.map(day => [day.date, day.costUsd])).toEqual([['2026-08-18', 0.44], ['2026-08-17', 0.22]])
    expect(aggregate.summary.byModel).toHaveLength(1)
    expect(aggregate.summary.byModel[0]?.provider).toBe('deepseek')
    expect(extractSessionUsage('a', header, events, { ...utcOptions, from: '2026-08-18' })).toHaveLength(1)
  })

  it('keeps provider totals separate even for the same model and filters all breakdowns consistently', () => {
    const events = [requestHeader(0, '2026-08-17T00:00:00Z'), stepStart(1), assistant(2, { inputTokens: 100, outputTokens: 5, cacheReadTokens: 20, cacheWriteTokens: 10 }),
      stepStart(3, 2), requestHeader(4, '2026-08-17T00:00:05Z', 'TOKENER'), assistant(5, { inputTokens: 7, outputTokens: 8 }, 2)]
    const source = { sessionId: 'a', title: 'A', header, events }
    expect(aggregateBilling([source], utcOptions).summary.byModel).toHaveLength(2)
    const { summary, requestsBySession } = aggregateBilling([source], { ...utcOptions, provider: 'tokener' })
    expect(summary.totals).toMatchObject({ requests: 1, inputTokens: 7, outputTokens: 8, unpricedRequests: 1 })
    expect(summary.byModel).toHaveLength(1)
    expect(summary.byDay[0]?.requests).toBe(1)
    expect(summary.bySession[0]?.requests).toBe(1)
    expect(requestsBySession.get('a')).toHaveLength(1)
  })
})
