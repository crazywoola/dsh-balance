/** Shared DeepSeek pricing schedule used by Host billing and the client indicator. */

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** The current V4 schedule became effective at 00:00 Beijing time on 2026-08-17. */
export const PEAK_EFFECTIVE_FROM = Date.parse('2026-08-17T00:00:00+08:00')

/** Official Flash prices took effect at 2026-09-10 04:00 UTC (V4.1-Flash price change). */
export const FLASH_CURRENT_EFFECTIVE_FROM = Date.parse('2026-09-10T04:00:00Z')

const PEAK_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [9, 12],
  [14, 18],
]

const BOUNDARY_SECONDS = [9 * 3600, 12 * 3600, 14 * 3600, 18 * 3600] as const

/**
 * Official rest days from the State Council General Office notice on the 2026 holiday
 * arrangements (国办发明电〔2025〕7号,
 * https://www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm).
 * These dates are all-day off-peak. Weekend makeup workdays in the same notice remain
 * off-peak because DeepSeek peak hours apply Monday–Friday only. Update this list when
 * a later official holiday notice is published.
 */
const CHINESE_PUBLIC_HOLIDAYS = new Set([
  '2026-01-01', '2026-01-02', '2026-01-03',
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22', '2026-02-23',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
])

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

interface BeijingCalendar {
  weekday: number
  hour: number
  secondsIntoDay: number
  dateKey: string
  dayStartMs: number
}

/** Calendar fields in Beijing time (UTC+8). */
function beijingCalendar(date: Date): BeijingCalendar {
  const beijing = new Date(date.getTime() + BEIJING_OFFSET_MS)
  const year = beijing.getUTCFullYear()
  const month = beijing.getUTCMonth()
  const day = beijing.getUTCDate()
  const hour = beijing.getUTCHours()
  const secondsIntoDay = hour * 3600 + beijing.getUTCMinutes() * 60 + beijing.getUTCSeconds()
  return {
    weekday: beijing.getUTCDay(),
    hour,
    secondsIntoDay,
    dateKey: `${year}-${pad(month + 1)}-${pad(day)}`,
    dayStartMs: Date.UTC(year, month, day) - BEIJING_OFFSET_MS,
  }
}

/** Whether the Beijing calendar day can have DeepSeek peak hours. */
function isPeakCalendarDay(date: Date): boolean {
  const { weekday, dateKey } = beijingCalendar(date)
  return weekday >= 1 && weekday <= 5 && !CHINESE_PUBLIC_HOLIDAYS.has(dateKey)
}

/** Whether the given instant falls inside a DeepSeek peak-pricing window. */
export function isPeakHour(date: Date): boolean {
  if (date.getTime() < PEAK_EFFECTIVE_FROM) return false
  if (!isPeakCalendarDay(date)) return false
  const hour = beijingCalendar(date).hour
  return PEAK_WINDOWS.some(([start, end]) => hour >= start && hour < end)
}

/** The next instant at which the current pricing period ends (Beijing time). */
export function nextPeriodChange(date: Date): Date {
  const ms = date.getTime()
  const { secondsIntoDay, dayStartMs } = beijingCalendar(date)
  if (isPeakCalendarDay(date)) {
    const boundary = BOUNDARY_SECONDS.find(seconds => secondsIntoDay < seconds)
    if (boundary !== undefined) return new Date(dayStartMs + boundary * 1000)
  }

  // After the last weekday window, or on a weekend/holiday: the next peak-day 09:00.
  let cursor = dayStartMs + DAY_MS + 9 * HOUR_MS
  for (let i = 0; i < 400; i += 1) {
    const candidate = new Date(cursor)
    if (candidate.getTime() > ms && isPeakCalendarDay(candidate)) return candidate
    cursor += DAY_MS
  }
  return new Date(cursor)
}
