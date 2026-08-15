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
