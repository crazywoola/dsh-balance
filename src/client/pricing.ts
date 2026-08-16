/**
 * DeepSeek API peak / off-peak pricing schedule.
 *
 * Official announcement (effective 2026-08-17, Beijing time):
 *   peak:     09:00–12:00 and 14:00–18:00 (UTC+8)
 *   off-peak: everything else, billed at half the peak price
 *
 * Windows are half-open: [09:00, 12:00) and [14:00, 18:00).
 */

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

/** The scheme goes live at 00:00 Beijing time on 2026-08-17. */
export const PEAK_EFFECTIVE_FROM = Date.parse('2026-08-17T00:00:00+08:00')

const PEAK_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [9, 12],
  [14, 18],
]

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const BOUNDARY_SECONDS = [9 * 3600, 12 * 3600, 14 * 3600, 18 * 3600] as const

/** Hour of day in Beijing time (UTC+8), 0–23. */
function beijingHour(date: Date): number {
  return new Date(date.getTime() + BEIJING_OFFSET_MS).getUTCHours()
}

/** Whether the given instant falls inside a DeepSeek peak-pricing window. */
export function isPeakHour(date: Date): boolean {
  if (date.getTime() < PEAK_EFFECTIVE_FROM) return false
  const hour = beijingHour(date)
  return PEAK_WINDOWS.some(([start, end]) => hour >= start && hour < end)
}

/** The next instant at which the current pricing period ends (Beijing time). */
export function nextPeriodChange(date: Date): Date {
  const ms = date.getTime()
  const beijing = new Date(ms + BEIJING_OFFSET_MS)
  const secondsIntoDay = beijing.getUTCHours() * 3600
    + beijing.getUTCMinutes() * 60
    + beijing.getUTCSeconds()

  let boundary = BOUNDARY_SECONDS.find(seconds => secondsIntoDay < seconds)
  if (boundary === undefined) {
    // After 18:00: the next boundary is tomorrow 09:00 Beijing time.
    boundary = 9 * 3600 + DAY_MS / 1000
  }

  const dayStartMs = Math.floor(ms / DAY_MS) * DAY_MS
  return new Date(dayStartMs + boundary * 1000 - BEIJING_OFFSET_MS)
}
