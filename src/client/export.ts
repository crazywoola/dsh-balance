/** CSV/JSON exporters for the usage views. All data stays in the browser. */
import type { UsageRequestRecord, UsageSessionAggregate, UsageSummary, UsageTotals } from '../billing.ts'

export interface CsvColumn {
  key: string
  label: string
}

export type UsageCategory = 'model' | 'provider' | 'session' | 'day'

export interface UsageExportContext {
  scope: 'all' | 'session'
  timeZone: string
  provider?: string
  from?: string
  to?: string
}

/** RFC 4180-style escaping: quote when the value contains a comma, quote or newline. */
export function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function usageCsv(columns: readonly CsvColumn[], rows: readonly Record<string, string | number>[]): string {
  const lines = [columns.map(column => csvCell(column.label)).join(',')]
  for (const row of rows) lines.push(columns.map(column => csvCell(row[column.key] ?? '')).join(','))
  return `${lines.join('\n')}\n`
}

const TOTALS_KEYS = [
  'requests', 'pricedRequests', 'freeRequests', 'unpricedRequests',
  'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens',
  'costUsd', 'nativeCostCny',
] as const

const TOTALS_COLUMNS: readonly CsvColumn[] = TOTALS_KEYS.map(key => ({ key, label: key }))

function totalsFields(totals: UsageTotals): Record<string, string | number> {
  const row: Record<string, string | number> = {}
  for (const key of TOTALS_KEYS) {
    const value = totals[key]
    row[key] = typeof value === 'number' ? value : ''
  }
  return row
}

function categoryColumns(category: UsageCategory): readonly CsvColumn[] {
  if (category === 'model') return [{ key: 'provider', label: 'provider' }, { key: 'model', label: 'model' }, ...TOTALS_COLUMNS]
  if (category === 'provider') return [{ key: 'provider', label: 'provider' }, ...TOTALS_COLUMNS]
  if (category === 'session') return [{ key: 'sessionId', label: 'sessionId' }, { key: 'title', label: 'title' }, ...TOTALS_COLUMNS]
  return [{ key: 'date', label: 'date' }, ...TOTALS_COLUMNS]
}

/** Export the category table the viewer currently sees. */
export function overviewCsv(summary: UsageSummary, category: UsageCategory): string {
  const rows: Record<string, string | number>[] = category === 'model'
    ? summary.byModel.map(item => ({ provider: item.provider, model: item.model, ...totalsFields(item) }))
    : category === 'provider'
      ? summary.byProvider.map(item => ({ provider: item.provider, ...totalsFields(item) }))
      : category === 'session'
        ? summary.bySession.map(item => ({ sessionId: item.sessionId, title: item.title, ...totalsFields(item) }))
        : summary.byDay.map(item => ({ date: item.date, ...totalsFields(item) }))
  return usageCsv(categoryColumns(category), rows)
}

/** Export the full summary with the filters that produced it. */
export function overviewJson(summary: UsageSummary, context: UsageExportContext): string {
  return `${JSON.stringify({
    exportedAt: new Date().toISOString(),
    scope: 'all',
    filters: {
      timeZone: context.timeZone,
      ...(context.provider === undefined ? {} : { provider: context.provider }),
      ...(context.from === undefined ? {} : { from: context.from }),
      ...(context.to === undefined ? {} : { to: context.to }),
    },
    summary,
  }, null, 2)}\n`
}

const REQUEST_COLUMNS: readonly CsvColumn[] = [
  { key: 'time', label: 'time' },
  { key: 'provider', label: 'provider' },
  { key: 'model', label: 'model' },
  { key: 'turn', label: 'turn' },
  { key: 'step', label: 'step' },
  { key: 'billingStatus', label: 'billingStatus' },
  { key: 'inputTokens', label: 'inputTokens' },
  { key: 'outputTokens', label: 'outputTokens' },
  { key: 'cacheReadTokens', label: 'cacheReadTokens' },
  { key: 'cacheWriteTokens', label: 'cacheWriteTokens' },
  { key: 'costUsd', label: 'costUsd' },
  { key: 'costCny', label: 'costCny' },
  { key: 'pricingVersion', label: 'pricingVersion' },
  { key: 'unknownReason', label: 'unknownReason' },
]

/** Export one session's request-level records. */
export function sessionCsv(requests: readonly UsageRequestRecord[]): string {
  return usageCsv(REQUEST_COLUMNS, requests.map(request => ({
    time: request.time,
    provider: request.provider ?? '',
    model: request.model ?? '',
    turn: request.turn,
    step: request.step,
    billingStatus: request.billingStatus,
    inputTokens: request.inputTokens,
    outputTokens: request.outputTokens,
    cacheReadTokens: request.cacheReadTokens,
    cacheWriteTokens: request.cacheWriteTokens,
    costUsd: request.costUsd ?? '',
    costCny: request.costCny ?? '',
    pricingVersion: request.pricingVersion ?? '',
    unknownReason: request.unknownReason ?? '',
  })))
}

/** Export one session's summary together with its request records. */
export function sessionJson(
  session: UsageSessionAggregate,
  summary: UsageSummary,
  requests: readonly UsageRequestRecord[],
  context: UsageExportContext,
): string {
  return `${JSON.stringify({
    exportedAt: new Date().toISOString(),
    scope: 'session',
    sessionId: session.sessionId,
    filters: { timeZone: context.timeZone },
    session,
    summary,
    requests,
  }, null, 2)}\n`
}

/** Trigger a browser download; a no-op outside a DOM environment. */
export function downloadTextFile(name: string, mime: string, text: string): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => { URL.revokeObjectURL(url) }, 0)
}
