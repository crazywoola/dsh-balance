import { describe, expect, it } from 'vitest'
import { isBeyondHolidayCalendar, isPeakHour, nextPeriodChange } from '../src/client/pricing.ts'

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

  it('stays off-peak on weekends and Chinese public holidays', () => {
    expect(isPeakHour(at('2026-08-22T10:00:00+08:00'))).toBe(false)
    expect(isPeakHour(at('2026-08-23T15:00:00+08:00'))).toBe(false)
    expect(isPeakHour(at('2026-09-25T10:00:00+08:00'))).toBe(false)
    expect(isPeakHour(at('2026-10-01T10:00:00+08:00'))).toBe(false)
    expect(isPeakHour(at('2026-10-08T10:00:00+08:00'))).toBe(true)
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
    expect(nextPeriodChange(at('2026-08-17T00:30:00+08:00'))).toEqual(at('2026-08-17T09:00:00+08:00'))
  })

  it('skips weekends and Chinese public holidays when finding the next peak start', () => {
    expect(nextPeriodChange(at('2026-08-21T18:00:00+08:00'))).toEqual(at('2026-08-24T09:00:00+08:00'))
    expect(nextPeriodChange(at('2026-08-22T10:00:00+08:00'))).toEqual(at('2026-08-24T09:00:00+08:00'))
    expect(nextPeriodChange(at('2026-09-24T18:00:00+08:00'))).toEqual(at('2026-09-28T09:00:00+08:00'))
    expect(nextPeriodChange(at('2026-10-01T10:00:00+08:00'))).toEqual(at('2026-10-08T09:00:00+08:00'))
  })

  it('is timezone independent', () => {
    // 15:30 Beijing == 07:30 UTC
    expect(nextPeriodChange(at('2026-08-17T07:30:00Z'))).toEqual(at('2026-08-17T10:00:00Z'))
  })
})

describe('2027 holiday calendar', () => {
  it('treats 2027 weekday rest days as off-peak', () => {
    for (const d of ['2027-01-01', '2027-02-05', '2027-02-12', '2027-04-05', '2027-05-04', '2027-06-09', '2027-09-15', '2027-10-07']) {
      expect(isPeakHour(at(`${d}T10:00:00+08:00`)), d).toBe(false)
    }
    expect(isPeakHour(at('2027-01-04T10:00:00+08:00'))).toBe(true)
    expect(isPeakHour(at('2027-06-10T10:00:00+08:00'))).toBe(true)
    expect(nextPeriodChange(at('2027-06-09T10:00:00+08:00')).toISOString()).toBe(at('2027-06-10T09:00:00+08:00').toISOString())
  })

  it('reports dates beyond the known calendar', () => {
    expect(isBeyondHolidayCalendar(at('2027-12-31T23:59:59+08:00'))).toBe(false)
    expect(isBeyondHolidayCalendar(at('2028-01-01T00:00:00+08:00'))).toBe(true)
  })
})
