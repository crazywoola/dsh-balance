import { describe, expect, it } from 'vitest'
import type { UsageRequestRecord, UsageSessionAggregate, UsageSummary, UsageTotals } from '../src/billing.ts'
import { csvCell, overviewCsv, overviewJson, sessionCsv, sessionJson, usageCsv } from '../src/client/export.ts'

const totals: UsageTotals = {
  requests: 2, pricedRequests: 1, freeRequests: 1, unpricedRequests: 0,
  inputTokens: 1_000, outputTokens: 200, cacheReadTokens: 30, cacheWriteTokens: 40,
  costUsd: 0.66, costCny: null, nativeCostCny: 0, cnyPricedRequests: 0, hasCompleteCnyTotal: true,
}

const summary: UsageSummary = {
  timeZone: 'UTC',
  usdToCny: null,
  cnyTotalMode: 'unavailable',
  totals,
  byProvider: [{ ...totals, provider: 'deepseek' }],
  byModel: [{ ...totals, provider: 'deepseek', model: 'deepseek-v4-flash' }],
  byDay: [{ ...totals, date: '2026-11-09' }],
  bySession: [{ ...totals, sessionId: 'a"b,c', title: 'Line\nbreak' }],
  byWeekdayHour: [],
}

const session: UsageSessionAggregate = { ...totals, sessionId: 'abcdef12-3456', title: 'A session' }

const request: UsageRequestRecord = {
  sessionId: 'abcdef12-3456',
  seq: 7,
  turn: 1,
  step: 0,
  time: '2026-11-09T00:00:01.000Z',
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  inputTokens: 1_000,
  outputTokens: 200,
  cacheReadTokens: 30,
  cacheWriteTokens: 0,
  costUsd: 0.66,
  billingStatus: 'priced',
  pricingVersion: 'deepseek-v4-2026-08-17',
}

describe('usage exporters', () => {
  it('escapes CSV cells per RFC 4180', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell(12)).toBe('12')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
  })

  it('writes a header row, one row per record and a trailing newline', () => {
    expect(usageCsv([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [{ a: 1, b: 'x' }, { a: 2 }]))
      .toBe('A,B\n1,x\n2,\n')
  })

  it('exports the visible category table with totals columns', () => {
    const csv = overviewCsv(summary, 'model')
    expect(csv.split('\n')[0]).toBe('provider,model,requests,pricedRequests,freeRequests,unpricedRequests,inputTokens,outputTokens,cacheReadTokens,cacheWriteTokens,costUsd,nativeCostCny')
    expect(csv).toContain('deepseek,deepseek-v4-flash,2,1,1,0,1000,200,30,40,0.66,0')
    expect(overviewCsv(summary, 'day').split('\n')[0]).toBe('date,requests,pricedRequests,freeRequests,unpricedRequests,inputTokens,outputTokens,cacheReadTokens,cacheWriteTokens,costUsd,nativeCostCny')
    expect(overviewCsv(summary, 'provider')).toContain('deepseek,2,1,1,0,1000,200,30,40,0.66,0')
    // Session titles with commas, quotes and newlines survive the round trip.
    expect(overviewCsv(summary, 'session')).toContain('"a""b,c","Line\nbreak",2,1,1,0,1000,200,30,40,0.66,0')
  })

  it('exports the full summary with its filters as JSON', () => {
    const json = JSON.parse(overviewJson(summary, { scope: 'all', timeZone: 'Asia/Shanghai', provider: 'deepseek', from: '2026-11-01', to: '2026-11-09' }))
    expect(json.scope).toBe('all')
    expect(json.filters).toEqual({ timeZone: 'Asia/Shanghai', provider: 'deepseek', from: '2026-11-01', to: '2026-11-09' })
    expect(json.summary.timeZone).toBe('UTC')
    expect(typeof json.exportedAt).toBe('string')
  })

  it('exports request-level records with nulls as empty cells', () => {
    const unpriced: UsageRequestRecord = {
      sessionId: request.sessionId, seq: 8, turn: request.turn, step: request.step, time: request.time,
      provider: null, model: null, inputTokens: request.inputTokens, outputTokens: request.outputTokens,
      cacheReadTokens: request.cacheReadTokens, cacheWriteTokens: 0, costUsd: null, costCny: 7,
      billingStatus: 'priced', unknownReason: 'unknown-model',
    }
    const csv = sessionCsv([request, unpriced])
    const lines = csv.trim().split('\n')
    expect(lines[0]).toBe('time,provider,model,turn,step,billingStatus,inputTokens,outputTokens,cacheReadTokens,cacheWriteTokens,costUsd,costCny,pricingVersion,unknownReason')
    expect(lines[1]).toBe('2026-11-09T00:00:01.000Z,deepseek,deepseek-v4-flash,1,0,priced,1000,200,30,0,0.66,,deepseek-v4-2026-08-17,')
    expect(lines[2]).toBe('2026-11-09T00:00:01.000Z,,,1,0,priced,1000,200,30,0,,7,,unknown-model')
  })

  it('exports one session with its summary and requests as JSON', () => {
    const json = JSON.parse(sessionJson(session, summary, [request], { scope: 'session', timeZone: 'UTC' }))
    expect(json.scope).toBe('session')
    expect(json.sessionId).toBe('abcdef12-3456')
    expect(json.session.title).toBe('A session')
    expect(json.requests).toHaveLength(1)
    expect(json.summary.totals.costUsd).toBe(0.66)
  })
})
