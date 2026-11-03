import { describe, expect, it, vi } from 'vitest'
import type { SessionPersistence, SessionPersistenceSnapshot } from '@deepseek-ai/dsh-session-persistence'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { UsageReader } from '../src/usage-reader.ts'
import { aggregateBillingRecords } from '../src/billing.ts'

const at = Date.parse('2026-11-03T01:00:00Z')
const events = [
  { seq: 0, time: at, type: 'request/header', data: { header: { config: { provider: 'Tokener', model: 'deepseek-flash' } } } },
  { seq: 1, time: at, type: 'step/start', data: { turn: 1, step: 0 } },
  { seq: 2, time: at, type: 'assistant/message', data: { turn: 1, step: 0, message: { content: 'private conversation body' }, usage: { inputTokens: 600, outputTokens: 100, cacheReadTokens: 400 } } },
] as unknown as SessionEvent[]
const snapshot = (id: string, revision = 'r1') => ({ header: { id }, revision }) as unknown as SessionPersistenceSnapshot

function setup() {
  let active = 0
  let maxActive = 0
  const close = vi.fn(async () => { active-- })
  const read = vi.fn(async () => {
    await new Promise(resolve => setImmediate(resolve))
    return { events }
  })
  const open = vi.fn(async () => {
    active++
    maxActive = Math.max(maxActive, active)
    return { read, close, inheritedEventCount: 0 }
  })
  const reader = new UsageReader({ open } as unknown as SessionPersistence)
  return { reader, open, read, close, maxActive: () => maxActive }
}

describe('bounded usage reads', () => {
  it('shares in-flight reads across queries and keeps only one complete log open at a time', async () => {
    const { reader, open, close, maxActive } = setup()
    const [a, b, again] = await Promise.all([
      reader.read(snapshot('a'), true), reader.read(snapshot('b'), true), reader.read(snapshot('a'), true),
    ])
    expect(again).toBe(a)
    expect(open).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledTimes(2)
    expect(maxActive()).toBe(1)
    expect(JSON.stringify([a, b])).not.toContain('private conversation body')
    expect(a).not.toHaveProperty('events')
    expect(a.records).toHaveLength(1)
    expect(aggregateBillingRecords([a, b], { timeZone: 'UTC', provider: 'TOKENER' }).summary.totals.requests).toBe(2)
    expect(aggregateBillingRecords([a, b], { timeZone: 'UTC', provider: 'stepfun' }).summary.totals.requests).toBe(0)
    expect(aggregateBillingRecords([a, b], { timeZone: 'UTC', from: '2026-11-04' }).summary.totals.requests).toBe(0)
    await reader.read(snapshot('a'), false)
    expect(open).toHaveBeenCalledTimes(2)
  })

  it('invalidates changed/deleted sessions and explicitly refreshed entries', async () => {
    const { reader, open } = setup()
    await reader.read(snapshot('a'), false)
    await reader.read(snapshot('a'), false)
    expect(open).toHaveBeenCalledOnce()
    await reader.read(snapshot('a', 'r2'), false)
    expect(open).toHaveBeenCalledTimes(2)
    await reader.read(snapshot('a', 'r2'), true)
    expect(open).toHaveBeenCalledTimes(3)
    reader.prune([])
    await reader.read(snapshot('a', 'r2'), false)
    expect(open).toHaveBeenCalledTimes(4)
  })

  it('closes failed reads, does not serve stale success, and allows later reads to recover', async () => {
    const { reader, open, read, close } = setup()
    await reader.read(snapshot('a'), false)
    read.mockRejectedValueOnce(new Error('read failure'))
    await expect(reader.read(snapshot('a'), true)).rejects.toThrow('read failure')
    expect(close).toHaveBeenCalledTimes(2)
    await reader.read(snapshot('a'), false)
    expect(open).toHaveBeenCalledTimes(3)
    expect(close).toHaveBeenCalledTimes(3)
  })
})
