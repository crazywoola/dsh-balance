import { describe, expect, it } from 'vitest'
import { isPeakHour, nextPeriodChange } from '../src/client/pricing.ts'

const at = (iso: string) => new Date(iso)

describe('isPeakHour', () => {
  it('flags the peak windows in Beijing time (09:00–12:00, 14:00–18:00)', () => {
    expect(isPeakHour(at('2026-08-17T08:59:59+08:00'))).toBe(false)
    expect(isPeakHour(at('2026-08-17T09:00:00+08:00'))).toBe(true)
    expect(isPeakHour(at('2026-08-17T11:59:59+08:00'))).toBe(true)
    expect(isPeakHour(at('2026-08-17T12:00:00+08:00'))).toBe(false)
    expect(isPeakHour(at('2026-08-17T13:59:59+08:00'))).toBe(false)
    expect(isPeakHour(at('2026-08-17T14:00:00+08:00'))).toBe(true)
    expect(isPeakHour(at('2026-08-17T17:59:59+08:00'))).toBe(true)
    expect(isPeakHour(at('2026-08-17T18:00:00+08:00'))).toBe(false)
    expect(isPeakHour(at('2026-08-17T23:59:59+08:00'))).toBe(false)
  })

  it('judges by Beijing time regardless of the local timezone', () => {
    // 09:30 Beijing == 01:30 UTC
    expect(isPeakHour(at('2026-08-17T01:30:00Z'))).toBe(true)
    // 20:00 Beijing == 12:00 UTC
    expect(isPeakHour(at('2026-08-17T12:00:00Z'))).toBe(false)
  })

  it('stays off-peak before the pricing scheme takes effect', () => {
    expect(isPeakHour(at('2026-08-16T10:00:00+08:00'))).toBe(false)
    expect(isPeakHour(at('2026-08-17T10:00:00+08:00'))).toBe(true)
  })
})

describe('nextPeriodChange', () => {
  it('returns the end of the current window', () => {
    expect(nextPeriodChange(at('2026-08-17T09:30:00+08:00'))).toEqual(at('2026-08-17T12:00:00+08:00'))
    expect(nextPeriodChange(at('2026-08-17T11:00:00+08:00'))).toEqual(at('2026-08-17T12:00:00+08:00'))
    expect(nextPeriodChange(at('2026-08-17T15:30:00+08:00'))).toEqual(at('2026-08-17T18:00:00+08:00'))
  })

  it('returns the next window start during off-peak hours', () => {
    expect(nextPeriodChange(at('2026-08-17T12:00:00+08:00'))).toEqual(at('2026-08-17T14:00:00+08:00'))
    expect(nextPeriodChange(at('2026-08-17T13:00:00+08:00'))).toEqual(at('2026-08-17T14:00:00+08:00'))
  })

  it('wraps to 09:00 Beijing time the next day after 18:00', () => {
    expect(nextPeriodChange(at('2026-08-17T18:00:00+08:00'))).toEqual(at('2026-08-18T09:00:00+08:00'))
    expect(nextPeriodChange(at('2026-08-17T23:59:59+08:00'))).toEqual(at('2026-08-18T09:00:00+08:00'))
  })

  it('is timezone independent', () => {
    // 15:30 Beijing == 07:30 UTC
    expect(nextPeriodChange(at('2026-08-17T07:30:00Z'))).toEqual(at('2026-08-17T10:00:00Z'))
  })
})
