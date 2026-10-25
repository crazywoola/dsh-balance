export function formatClockTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
}

export function displayAmount(value: string, currency: string, locale: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${value} ${currency}`

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(amount)
  } catch {
    return `${value} ${currency}`
  }
}

export function displayTokens(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

export function displayDate(value: string | Date, locale: string, timeZone?: string): string {
  const date = typeof value === 'string' ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', ...(timeZone === undefined ? {} : { timeZone }) }).format(date)
}
