/** Shared DeepSeek pricing schedule used by Host billing and the client indicator. */

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** The current V4 schedule became effective at 00:00 Beijing time on 2026-08-17. */
export const PEAK_EFFECTIVE_FROM = Date.parse('2026-08-17T00:00:00+08:00')

const PEAK_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [9, 12],
  [14, 18],
]

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
  if (boundary === undefined) boundary = 9 * 3600 + DAY_MS / 1000

  const dayStartMs = Math.floor(ms / DAY_MS) * DAY_MS
  return new Date(dayStartMs + boundary * 1000 - BEIJING_OFFSET_MS)
}
