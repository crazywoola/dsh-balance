import { describe, expect, it } from 'vitest'
import { nextPeriodChange } from '../src/pricing.ts'
import { calculateRequestCost, resolveBillingPrice } from '../src/billing.ts'
import type { BillingUsage, UsageRequestRecord } from '../src/billing.ts'
import {
  ADVICE_SAMPLE_LIMIT,
  buildAdvice,
  freshSessionUsage,
  medianTokenShape,
  medianTokens,
  recentPricedRequests,
} from '../src/advice.ts'

const SHAPE: BillingUsage = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cacheReadTokens: 1_000_000,
  cacheWriteTokens: 0,
}

function record(overrides: Partial<UsageRequestRecord> & Pick<UsageRequestRecord, 'seq' | 'time'>): UsageRequestRecord {
  return {
    sessionId: 'session-a',
    turn: 1,
    step: 0,
    provider: 'deepseek',
    model: 'deepseek-flash',
    inputTokens: SHAPE.inputTokens,
    outputTokens: SHAPE.outputTokens,
    cacheReadTokens: SHAPE.cacheReadTokens,
    cacheWriteTokens: SHAPE.cacheWriteTokens,
    costUsd: 0.753,
    billingStatus: 'priced',
    ...overrides,
  }
}

function expectedCost(provider: string, model: string, usage: BillingUsage, at: Date): number {
  const price = resolveBillingPrice(provider, model, at.getTime())
  expect(price).toBeDefined()
  return calculateRequestCost(usage, price!, at.getTime())
}

describe('token shape helpers', () => {
  it('takes the median of an odd or even token list and rounds the midpoint', () => {
    expect(medianTokens([10])).toBe(10)
    expect(medianTokens([100, 10, 20])).toBe(20)
    expect(medianTokens([10, 20])).toBe(15)
    expect(medianTokens([11, 12])).toBe(12)
  })

  it('uses only the most recent priced requests, oldest first, and medians each bucket independently', () => {
    const records = [
      record({ seq: 1, time: '2026-09-10T04:00:00.000Z', inputTokens: 10, outputTokens: 1, billingStatus: 'unpriced', costUsd: null }),
      record({ seq: 2, time: '2026-09-10T04:01:00.000Z', inputTokens: 100, outputTokens: 3, cacheReadTokens: 1 }),
      record({ seq: 3, time: '2026-09-10T04:02:00.000Z', inputTokens: 20, outputTokens: 9, cacheReadTokens: 7 }),
      record({ seq: 4, time: '2026-09-10T04:03:00.000Z', inputTokens: 40, outputTokens: 5, cacheReadTokens: 3, billingStatus: 'free', costUsd: 0 }),
      record({ seq: 5, time: '2026-09-10T04:04:00.000Z', inputTokens: 30, outputTokens: 6, cacheReadTokens: 8 }),
    ]
    const sample = recentPricedRequests(records, 2)
    expect(sample.map(item => item.seq)).toEqual([3, 5])
    expect(medianTokenShape(sample)).toEqual({
      inputTokens: 25,
      outputTokens: 8,
      cacheReadTokens: 8,
      cacheWriteTokens: 0,
    })
  })
})

describe('buildAdvice', () => {
  it('prices the current official Flash schedule and the 2026-08-17 historical tier from the same token shape', () => {
    const currentAt = new Date('2026-09-10T04:00:00Z') // 12:00 Beijing, weekday lunch off-peak
    const historicalAt = new Date('2026-08-17T00:00:00Z') // 08:00 Beijing, weekday off-peak
    const records = [record({ seq: 1, time: currentAt.toISOString() })]

    const current = buildAdvice({ sessionId: 'session-a', records, at: currentAt, configuredProviders: ['deepseek'] })
    expect(current.ok).toBe(true)
    expect(current.estimateOnly).toBe(true)
    expect(current.currentPeriod).toBe('off-peak')
    expect(current.nextChangeAt).toBe(nextPeriodChange(currentAt).toISOString())
    expect(current.sampleSize).toBe(1)
    expect(current.sampleLimit).toBe(ADVICE_SAMPLE_LIMIT)
    expect(current.tokenShape).toEqual(SHAPE)
    expect(current.now).toMatchObject({
      kind: 'now',
      provider: 'deepseek',
      model: 'deepseek-flash',
      period: 'off-peak',
      pricingVersion: 'deepseek-flash-2026-09-10',
      costUsd: expectedCost('deepseek', 'deepseek-flash', SHAPE, currentAt),
      combinedCny: null,
    })
    expect(current.now?.costUsd).toBe(0.753)
    expect(current.now).not.toHaveProperty('costCny')
    expect(current.afterChange?.costUsd).toBe(expectedCost('deepseek', 'deepseek-flash', SHAPE, nextPeriodChange(currentAt)))
    expect(current.fresh?.costUsd).toBe(expectedCost('deepseek', 'deepseek-flash', freshSessionUsage(SHAPE), currentAt))
    expect(current.fresh?.costUsd).toBe(0.9)
    expect(current.cacheSavings).toEqual({ costUsd: 0.147, combinedCny: null })
    expect(current.alternatives.some(item => item.model === 'deepseek-v4-pro')).toBe(true)
    expect(current.alternatives.some(item => item.model === 'deepseek-v4-flash' || item.model === 'deepseek-flash')).toBe(false)
    expect(current.caveats).toEqual(['estimate-not-a-bill', 'shape-may-differ'])
    expect(JSON.stringify(current)).not.toMatch(/prompt|SECRET/i)

    const historical = buildAdvice({
      sessionId: 'session-a',
      records: [record({ seq: 1, time: historicalAt.toISOString(), model: 'deepseek-v4-flash' })],
      current: { provider: 'deepseek', model: 'deepseek-v4-flash' },
      at: historicalAt,
    })
    expect(historical.now).toMatchObject({
      pricingVersion: 'deepseek-v4-2026-08-17',
      period: 'off-peak',
      costUsd: 0.887,
    })
    expect(historical.afterChange?.period).toBe('peak')
    expect(historical.afterChange?.costUsd).toBe(1.774)
    expect(historical.now?.pricingVersion).not.toBe(current.now?.pricingVersion)
  })

  it('keeps weekday peak distinct from weekend and Chinese public holiday off-peak', () => {
    const usage = SHAPE
    const weekdayPeak = new Date('2026-09-10T06:00:00Z') // Thursday 14:00 Beijing, current Flash peak
    const saturday = new Date('2026-08-22T01:00:00Z') // Saturday 09:00 Beijing, historical tier
    const holiday = new Date('2026-10-01T01:00:00Z') // National Day Thursday 09:00 Beijing

    const peak = buildAdvice({
      sessionId: 'session-a',
      records: [record({ seq: 1, time: weekdayPeak.toISOString() })],
      at: weekdayPeak,
    })
    expect(peak.currentPeriod).toBe('peak')
    expect(peak.now?.costUsd).toBe(1.506)
    expect(peak.afterChange?.period).toBe('off-peak')
    expect(peak.afterChange?.costUsd).toBe(0.753)

    const weekend = buildAdvice({
      sessionId: 'session-a',
      records: [record({ seq: 1, time: saturday.toISOString(), model: 'deepseek-v4-flash' })],
      current: { provider: 'deepseek', model: 'deepseek-v4-flash' },
      at: saturday,
    })
    expect(weekend.currentPeriod).toBe('off-peak')
    expect(weekend.now?.costUsd).toBe(0.887)
    expect(weekend.afterChange?.period).toBe('peak')

    const nationalDay = buildAdvice({
      sessionId: 'session-a',
      records: [record({ seq: 1, time: holiday.toISOString() })],
      at: holiday,
    })
    expect(nationalDay.currentPeriod).toBe('off-peak')
    expect(nationalDay.now?.costUsd).toBe(expectedCost('deepseek', 'deepseek-flash', usage, holiday))
    expect(nationalDay.now?.costUsd).toBe(0.753)
  })

  it('applies the StepFun step-5-preview cache-hit change and surfaces the grandfathering caveat after 2026-10-14', () => {
    const pre = new Date('2026-10-13T16:29:59Z') // 00:29:59 Beijing on 2026-10-14
    const post = new Date('2026-10-13T16:30:00Z') // 00:30:00 Beijing
    const records = [record({
      seq: 1,
      time: pre.toISOString(),
      provider: 'stepfun',
      model: 'step-5-preview',
      costUsd: null,
      costCny: 27.35,
    })]

    const before = buildAdvice({ sessionId: 'session-a', records, at: pre })
    expect(before.currentPeriod).toBe('standard')
    expect(before.nextChangeAt).toBeNull()
    expect(before.afterChange).toBeUndefined()
    expect(before.now).toMatchObject({
      provider: 'stepfun',
      model: 'step-5-preview',
      period: 'standard',
      pricingVersion: 'stepfun-reference-2026-09-30',
      costUsd: null,
      costCny: 27.35,
      combinedCny: null,
    })
    expect(before.fresh?.costCny).toBe(34)
    expect(before.cacheSavings).toEqual({ costUsd: null, costCny: 6.65, combinedCny: null })
    expect(before.caveats).not.toContain('stepfun-grandfathering')

    const after = buildAdvice({
      sessionId: 'session-a',
      records: [{ ...records[0]!, time: post.toISOString(), costCny: 27.7 }],
      at: post,
    })
    expect(after.now).toMatchObject({
      pricingVersion: 'stepfun-reference-2026-11-10',
      costCny: 27.7,
    })
    expect(after.afterChange).toBeUndefined()
    expect(after.caveats).toContain('stepfun-grandfathering')
    expect(after.caveats).toContain('estimate-not-a-bill')
  })

  it('omits unpriced models instead of showing them as $0, and does not invent a Tokener or StepFun peak multiplier', () => {
    const at = new Date('2026-09-10T06:00:00Z') // DeepSeek current-tier peak, should not affect other providers
    const records = [
      record({ seq: 1, time: at.toISOString() }),
      record({
        seq: 2,
        time: at.toISOString(),
        provider: 'deepseek',
        model: 'not-a-model',
        billingStatus: 'unpriced',
        costUsd: null,
      }),
    ]
    const advice = buildAdvice({
      sessionId: 'session-a',
      records,
      compare: [
        { provider: 'deepseek', model: 'mystery-model' },
        { provider: 'tokener', model: 'also-unknown' },
      ],
      configuredProviders: ['deepseek'],
      at,
    })
    expect(advice.now?.costUsd).toBe(1.506)
    expect(advice.alternatives.every(item => item.costUsd !== 0 || item.costCny !== 0)).toBe(true)
    expect(advice.alternatives.some(item => item.model === 'not-a-model' || item.model === 'mystery-model' || item.model === 'also-unknown')).toBe(false)
    expect(advice.caveats).toContain('unpriced-omitted')
    expect(JSON.stringify(advice.alternatives)).not.toContain('mystery-model')
    expect(advice.coverage).toMatchObject({ requests: 2, pricedRequests: 1, unpricedRequests: 1, status: 'partial' })

    const tokenerShape: BillingUsage = { ...SHAPE, cacheWriteTokens: 0 }
    const tokener = buildAdvice({
      sessionId: 'session-a',
      records: [record({
        seq: 1,
        time: at.toISOString(),
        provider: 'tokener',
        model: 'deepseek-flash',
        ...tokenerShape,
        costUsd: expectedCost('tokener', 'deepseek-flash', tokenerShape, at),
      })],
      at,
    })
    expect(tokener.currentPeriod).toBe('standard')
    expect(tokener.nextChangeAt).toBeNull()
    expect(tokener.afterChange).toBeUndefined()
    expect(tokener.now?.period).toBe('standard')
    expect(tokener.now?.costUsd).toBe(expectedCost('tokener', 'deepseek-flash', tokenerShape, new Date('2026-09-10T08:00:00Z')))
    expect(tokener.caveats).toContain('tokener-snapshot')
  })

  it('adds combined CNY only when usdToCny is set, and reports an empty sample honestly', () => {
    const at = new Date('2026-09-10T04:00:00Z')
    const withRate = buildAdvice({
      sessionId: 'session-a',
      records: [record({ seq: 1, time: at.toISOString() })],
      usdToCny: 7,
      at,
    })
    expect(withRate.now?.combinedCny).toBe(0.753 * 7)
    expect(withRate.fresh?.combinedCny).toBe(0.9 * 7)
    expect(withRate.cacheSavings?.combinedCny).toBe(0.147 * 7)

    const empty = buildAdvice({ sessionId: 'session-a', records: [], at })
    expect(empty.tokenShape).toBeNull()
    expect(empty.now).toBeUndefined()
    expect(empty.alternatives).toEqual([])
    expect(empty.coverage.status).toBe('empty')
    expect(empty.caveats).toContain('no-priced-sample')
    expect(empty.caveats).toContain('estimate-not-a-bill')
    expect(empty.caveats).not.toContain('shape-may-differ')
  })
})
