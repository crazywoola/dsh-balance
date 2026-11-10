import type {} from '@deepseek-ai/dsh-token-meter/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  UsageApiResponse,
  UsageRequestRecord,
  UsageSessionSuccess,
  UsageSummary,
  UsageTotals,
} from '../billing.ts'
import { findBalanceProvider } from '../providers.ts'
import { Punchcard } from './Punchcard.tsx'
import { Dropdown } from './Dropdown.tsx'
import { DetailPanel, PagedRows } from './BillingDetails.tsx'
import { displayAmount, displayTokens } from './format.ts'
import type { UsageCategory } from './export.ts'
import { downloadTextFile, overviewCsv, overviewJson, sessionCsv, sessionJson } from './export.ts'
import type { DshBalanceLocaleKey, LOCALE_NS } from './locales.ts'
import { AdviceCard } from './AdviceCard.tsx'
import type { AdviceLoadOptions } from './AdviceCard.tsx'
import type { AdviceApiResponse } from '../advice.ts'

export interface UsageLoadOptions {
  provider?: string
  scope: 'all' | 'session'
  sessionId?: string
  timeZone: string
  from?: string
  to?: string
  forceRefresh?: boolean
}

export interface UsageTabInjected {
  loadUsage: (options: UsageLoadOptions, signal: AbortSignal) => Promise<UsageApiResponse>
  loadAdvice?: (options: AdviceLoadOptions, signal: AbortSignal) => Promise<AdviceApiResponse>
}

export type BillingOverviewProps = UsageTabInjected & PropsLocale<typeof LOCALE_NS> & { provider?: string }
export type BillingViewProps = PropsRuntime<'conversation.view'> & InjectFace<UsageTabInjected> & PropsLocale<typeof LOCALE_NS>

export type UsageRange = 'today' | '7d' | '30d' | 'all' | 'custom'
export type UsageCategoryState = 'model' | 'provider' | 'session' | 'day'

/** Zones offered by the time-zone selector; the browser default always leads. */
const COMMON_TIME_ZONES = [
  'UTC',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
] as const

/** localStorage key for the display-only USD→CNY rate. */
const RATE_STORAGE_KEY = 'dsh-balance:usd-to-cny'

/** Read the stored display rate; storage failures degrade to no rate. */
export function readStoredRate(): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(RATE_STORAGE_KEY)
    const value = raw === null || raw === undefined ? Number.NaN : Number(raw)
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/** Persist or clear the display rate; storage failures stay session-only. */
export function writeStoredRate(value: number | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(RATE_STORAGE_KEY)
    else globalThis.localStorage?.setItem(RATE_STORAGE_KEY, String(value))
  } catch {
    // Private-mode or disabled storage: the rate applies to this view only.
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function formatTokens(value: number, locale = 'en-US'): string {
  return displayTokens(value, locale)
}

function amount(value: number | null, currency: 'USD' | 'CNY', locale: string): string {
  return value === null ? '—' : displayAmount(String(value), currency, locale)
}

function localDateKey(timeZone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year ?? '0000'}-${values.month ?? '00'}-${values.day ?? '00'}`
}

/** A strict YYYY-MM-DD calendar date, matching the Host validation. */
export function isDateValue(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === value
}

/** Shift a calendar date by whole days, independent of the viewer's time zone. */
export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** A resolved bounded range; `{}` means all time. */
export interface UsageDateRange {
  from: string
  to: string
}

/**
 * Resolve the requested range into query dates in the given time zone.
 * Omitted dates mean all time; `undefined` means the custom range is incomplete or inverted.
 */
export function resolveUsageDates(range: UsageRange, custom: { from: string; to: string }, today: string): { from?: string; to?: string } | undefined {
  if (range === 'all') return {}
  if (range === 'custom') {
    if (!isDateValue(custom.from) || !isDateValue(custom.to) || custom.from > custom.to) return undefined
    return { from: custom.from, to: custom.to }
  }
  const days = range === 'today' ? 0 : range === '7d' ? 6 : 29
  return { from: shiftDate(today, -days), to: today }
}

function hasRange(dates: { from?: string; to?: string } | undefined): dates is UsageDateRange {
  return dates?.from !== undefined && dates.to !== undefined
}

/** The one metric the cards lead with, so projection and comparison stay consistent. */
export function primaryMetric(totals: UsageTotals): { value: number | null; currency: 'USD' | 'CNY'; unpriced: boolean } {
  const unpriced = totals.pricedRequests === 0 && totals.freeRequests === 0 && totals.unpricedRequests > 0
  const cnyOnly = totals.cnyPricedRequests > 0 && totals.pricedRequests === totals.cnyPricedRequests
  return unpriced ? { value: null, currency: 'USD', unpriced }
    : cnyOnly ? { value: totals.nativeCostCny, currency: 'CNY', unpriced: false }
      : { value: totals.costUsd, currency: 'USD', unpriced: false }
}

/** Month-to-date spend scaled to the full month, in the summary's time zone. */
export function monthProjection(summary: UsageSummary): { amount: number; elapsed: number; total: number } | undefined {
  const today = localDateKey(summary.timeZone)
  const elapsed = Number(today.slice(8, 10))
  const total = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate()
  if (!Number.isFinite(elapsed) || elapsed <= 0 || total <= 0) return undefined
  const metric = primaryMetric(summary.totals)
  if (metric.unpriced || metric.value === null) return undefined
  const monthKey = today.slice(0, 7)
  let spent = 0
  let seen = false
  for (const day of summary.byDay) {
    if (!day.date.startsWith(monthKey)) continue
    const dayMetric = primaryMetric(day)
    if (dayMetric.unpriced || dayMetric.value === null || dayMetric.currency !== metric.currency) continue
    spent += dayMetric.value
    seen = true
  }
  if (!seen) return undefined
  return { amount: spent / elapsed * total, elapsed, total }
}

function totalForDay(summary: UsageSummary, date: string): UsageTotals {
  return summary.byDay.find(item => item.date === date) ?? {
    requests: 0,
    pricedRequests: 0,
    freeRequests: 0,
    unpricedRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    costCny: summary.usdToCny === null ? null : 0,
    nativeCostCny: 0,
    cnyPricedRequests: 0,
    hasCompleteCnyTotal: summary.usdToCny !== null,
  }
}

function ErrorMessage({ result, t }: { result: UsageApiResponse; t: BillingOverviewProps['t'] }) {
  if (result.ok === true) return null
  const key = `billing.error.${result.code}` as DshBalanceLocaleKey
  const detail = result.code === 'SESSION_NOT_FOUND' && result.message ? ` (${result.message})` : ''
  return <p className="dsh-balance-error" role="alert">{t(key)}{detail}</p>
}

function CostLabel({ totals, t, usdToCny = null }: { totals: UsageTotals; t: BillingOverviewProps['t']; usdToCny?: number | null }) {
  const locale = t('locale.tag')
  const metric = primaryMetric(totals)
  const unpriced = metric.unpriced
  const cnyOnly = !unpriced && metric.currency === 'CNY'
  const mixed = totals.cnyPricedRequests > 0 && !cnyOnly
  // The display rate converts on the client, so it works without a Host restart.
  const combined = usdToCny === null ? null : roundMoney(totals.nativeCostCny + totals.costUsd * usdToCny)
  return (
    <div className="dsh-billing-cost-value">
      <strong>{unpriced ? t('billing.notPriced') : cnyOnly ? amount(totals.nativeCostCny, 'CNY', locale) : amount(totals.costUsd, 'USD', locale)}</strong>
      {mixed ? <span>{amount(totals.nativeCostCny, 'CNY', locale)} {t('billing.nativeCny')}</span> : null}
      {totals.unpricedRequests > 0 && !unpriced ? <small>{t('billing.partial')}</small> : null}
      {combined !== null && !unpriced && !cnyOnly ? <span>{amount(combined, 'CNY', locale)} {t('billing.fixedRate')}</span> : null}
    </div>
  )
}

function SummaryCards({ summary, t, comparison, showProjection = true, usdToCny = null }: {
  summary: UsageSummary
  t: BillingOverviewProps['t']
  comparison?: ReactNode
  showProjection?: boolean
  usdToCny?: number | null
}) {
  const today = totalForDay(summary, localDateKey(summary.timeZone))
  const projection = showProjection ? monthProjection(summary) : undefined
  const metric = primaryMetric(summary.totals)
  const locale = t('locale.tag')
  return (
    <div className="dsh-billing-card-grid">
      <article className="dsh-billing-card dsh-billing-card-primary">
        <span>{t('billing.totalCost')}</span>
        <CostLabel totals={summary.totals} t={t} usdToCny={usdToCny} />
        {projection !== undefined && !metric.unpriced && metric.value !== null
          ? <small title={t('billing.monthProjectionHint', projection)}>{t('billing.monthProjection', { amount: displayAmount(String(Math.round(projection.amount * 1e4) / 1e4), metric.currency, locale) })}</small>
          : null}
        <small>{t('billing.pricedRequests', { count: summary.totals.pricedRequests })} · {t('billing.freeRequests' as DshBalanceLocaleKey, { count: summary.totals.freeRequests ?? 0 })}</small>
        {comparison}
      </article>
      <article className="dsh-billing-card">
        <span>{t('billing.todayCost')}</span>
        <CostLabel totals={today} t={t} usdToCny={usdToCny} />
        <small>{t('billing.today', { date: localDateKey(summary.timeZone) })}</small>
      </article>
      <article className="dsh-billing-card">
        <span>{t('billing.tokens')}</span>
        <strong>{formatTokens(summary.totals.inputTokens + summary.totals.outputTokens + summary.totals.cacheReadTokens + summary.totals.cacheWriteTokens, t('locale.tag'))}</strong>
        <TotalsCaption totals={summary.totals} t={t} />
        <small>{t('billing.requestCount', { count: summary.totals.requests })}</small>
      </article>
      <article className="dsh-billing-card" data-warning={summary.totals.unpricedRequests > 0 ? 'true' : 'false'}>
        <span>{t('billing.unpriced')}</span>
        <strong>{formatTokens(summary.totals.unpricedRequests, t('locale.tag'))}</strong>
        <small>{t('billing.unpricedHint')}</small>
      </article>
    </div>
  )
}

/** Display-only exchange rate; the Host configuration wins when present. */
function RateEditor({ value, configured, onChange, t }: {
  value: number | null
  configured: boolean
  onChange: (value: number | null) => void
  t: BillingOverviewProps['t']
}) {
  const [text, setText] = useState(value === null ? '' : String(value))
  useEffect(() => { setText(value === null ? '' : String(value)) }, [value])
  const invalid = text.trim() !== '' && !(Number(text) > 0)
  return (
    <label className="dsh-billing-rate" title={configured ? t('rate.configured') : invalid ? t('rate.invalid') : t('rate.hint')}>
      <span>{t('rate.usdToCny')}</span>
      <input type="number" inputMode="decimal" min="0" step="any" value={text} disabled={configured}
        aria-label={t('rate.usdToCny')} data-invalid={invalid ? 'true' : undefined}
        onChange={event => {
          const next = event.target.value
          setText(next)
          const parsed = Number(next)
          onChange(next.trim() === '' || !(parsed > 0) ? null : parsed)
        }} />
    </label>
  )
}

function TotalsCaption({ totals, t }: { totals: Pick<UsageTotals, 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens'>; t: BillingOverviewProps['t'] }) {
  return <span className="dsh-billing-token-caption">
    <span>{t('billing.inputShort')} <b>{formatTokens(totals.inputTokens, t('locale.tag'))}</b></span>
    <span>{t('billing.outputShort')} <b>{formatTokens(totals.outputTokens, t('locale.tag'))}</b></span>
    <span>{t('billing.cacheReadShort')} <b>{formatTokens(totals.cacheReadTokens, t('locale.tag'))}</b></span>
    {totals.cacheWriteTokens > 0 ? <span>{t('billing.cacheWriteShort')} <b>{formatTokens(totals.cacheWriteTokens, t('locale.tag'))}</b></span> : null}
  </span>
}

/** Previous-period delta under the total card; only meaningful for bounded ranges. */
export function PeriodComparison({ load, previousOptions, current, t }: {
  load: UsageTabInjected['loadUsage']
  previousOptions: UsageLoadOptions
  current: UsageApiResponse | undefined
  t: BillingOverviewProps['t']
}) {
  const { result: previous } = useUsageResult(load, previousOptions, JSON.stringify(previousOptions))
  const locale = t('locale.tag')
  const now = current?.ok === true && current.scope === 'all' ? primaryMetric(current.summary.totals) : undefined
  if (now === undefined || now.unpriced || now.value === null) return null
  if (previous?.ok === false) return <small className="dsh-billing-compare">{t('billing.compareNA')}</small>
  const before = previous?.ok === true && previous.scope === 'all' ? primaryMetric(previous.summary.totals) : undefined
  if (before === undefined || before.unpriced) return null
  if (before.value === null || before.value === 0) {
    return now.value > 0 ? <small className="dsh-billing-compare">{t('billing.compareNew')}</small> : null
  }
  if (before.currency !== now.currency) return null
  const delta = (now.value - before.value) / Math.abs(before.value) * 100
  if (!Number.isFinite(delta)) return null
  if (Math.abs(delta) < 0.5) return <small className="dsh-billing-compare">{t('billing.compareSame')}</small>
  const round = (value: number) => displayAmount(String(Math.round(value * 1e4) / 1e4), before.currency, locale)
  return <small className="dsh-billing-compare">{t('billing.compareDelta', {
    sign: delta > 0 ? '+' : '−',
    percent: Math.abs(delta).toFixed(0),
    previous: round(before.value),
    current: round(now.value),
  })}</small>
}

function ModelRows({ summary, items = summary.byModel, t, usdToCny = null }: { summary: UsageSummary; items?: readonly UsageSummary['byModel'][number][]; t: BillingOverviewProps['t']; usdToCny?: number | null }) {
  return <div className="dsh-billing-list">
    {items.length === 0 ? <p className="dsh-balance-status">{t('billing.empty')}</p> : items.map(item => (
      <article className="dsh-billing-list-row" key={JSON.stringify([item.provider, item.model])}>
        <div className="dsh-billing-row-main">
          <div className="dsh-billing-row-title">
            <code className="dsh-billing-name" title={item.model}>{item.model}</code>
            <span className="dsh-billing-provider-tag" title={item.provider}>{findBalanceProvider(item.provider)?.name ?? item.provider}</span>
          </div>
          <TotalsCaption totals={item} t={t} />
        </div>
        <div className="dsh-billing-list-value">
          <CostLabel totals={item} t={t} usdToCny={usdToCny} />
          <small>{t('billing.requestCount', { count: item.requests })}{item.pricedRequests > item.cnyPricedRequests && summary.totals.costUsd > 0 ? ` · ${t('billing.share', { percent: `${Math.round(item.costUsd / summary.totals.costUsd * 100)}%` })}` : ''}</small>
        </div>
      </article>
    ))}
  </div>
}

function AggregateRows({ items, t, usdToCny = null, onSelect }: {
  items: readonly { key: string; title: string; totals: UsageTotals }[]
  t: BillingOverviewProps['t']
  usdToCny?: number | null
  onSelect?: ((key: string) => void) | undefined
}) {
  return <div className="dsh-billing-list">
    {items.length === 0 ? <p className="dsh-balance-status">{t('billing.empty')}</p> : items.map(item => (
      <article className="dsh-billing-list-row" key={item.key}>
        <div className="dsh-billing-row-main">
          {onSelect === undefined
            ? <span className="dsh-billing-session-title" title={item.title}>{item.title}</span>
            : <button type="button" className="dsh-billing-session-title dsh-billing-session-action" title={item.title}
              aria-label={t('billing.sessionDrill')} onClick={() => onSelect(item.key)}>{item.title}</button>}
          <TotalsCaption totals={item.totals} t={t} />
        </div>
        <div className="dsh-billing-list-value"><CostLabel totals={item.totals} t={t} usdToCny={usdToCny} /><small>{t('billing.requestCount', { count: item.totals.requests })}</small></div>
      </article>
    ))}
  </div>
}

function UsageTables({ summary, t, usdToCny = null, category, onCategoryChange, onSessionSelect }: {
  summary: UsageSummary
  t: BillingOverviewProps['t']
  usdToCny?: number | null
  category: UsageCategoryState
  onCategoryChange: (value: UsageCategoryState) => void
  onSessionSelect?: (sessionId: string) => void
}) {
  const rows: { key: string; title: string; totals: UsageTotals }[] = category === 'provider' ? summary.byProvider.map(item => ({ key: item.provider, title: findBalanceProvider(item.provider)?.name ?? item.provider, totals: item }))
    : category === 'session' ? summary.bySession.map(item => ({ key: item.sessionId, title: item.title, totals: item }))
      : summary.byDay.map(item => ({ key: item.date, title: item.date, totals: item }))
  return <DetailPanel label={t('billing.categories')} value={category} onChange={onCategoryChange} tabs={[
    { value: 'model', label: t('billing.modelsLabel'), count: summary.byModel.length },
    { value: 'provider', label: t('billing.providersLabel'), count: summary.byProvider.length },
    { value: 'session', label: t('billing.sessionsLabel'), count: summary.bySession.length },
    { value: 'day', label: t('billing.daysLabel'), count: summary.byDay.length },
  ]}>
    {category === 'model'
      ? <PagedRows key="model" items={summary.byModel} t={t} render={items => <ModelRows items={items} summary={summary} t={t} usdToCny={usdToCny} />} />
      : <PagedRows key={category} items={rows} t={t} render={items => <AggregateRows items={items} t={t} usdToCny={usdToCny} onSelect={category === 'session' ? onSessionSelect : undefined} />} />}
  </DetailPanel>
}

function SessionDetails({ result, t, usdToCny = null }: { result: UsageSessionSuccess; t: BillingOverviewProps['t']; usdToCny?: number | null }) {
  const [category, setCategory] = useState<'model' | 'request'>('model')
  const [model, setModel] = useState('')
  const modelKey = (request: UsageRequestRecord) => JSON.stringify([request.provider ?? '', request.model ?? ''])
  const models = [...new Map(result.requests.map(request => [modelKey(request), `${request.provider ?? '?'} / ${request.model ?? t('billing.unknownModel')}`])).entries()]
  // A changing session or disappearing model must not leave an empty, stale filter.
  const selectedModel = models.some(([key]) => key === model) ? model : ''
  const requests = selectedModel === '' ? result.requests : result.requests.filter(request => modelKey(request) === selectedModel)
  return <DetailPanel label={t('billing.sessionDetails')} value={category} onChange={setCategory} tabs={[
    { value: 'model', label: t('billing.modelsLabel'), count: result.summary.byModel.length },
    { value: 'request', label: t('billing.requestDetails'), count: result.requests.length },
  ]} toolbar={category === 'request' ? <Dropdown label={t('billing.filterModel')} value={selectedModel} onChange={setModel}
    options={[{ value: '', label: t('billing.allModels') }, ...models.map(([value, label]) => ({ value, label }))]} /> : undefined}>
    {category === 'model'
      ? <PagedRows key="model" items={result.summary.byModel} t={t} render={items => <ModelRows items={items} summary={result.summary} t={t} usdToCny={usdToCny} />} />
      : <PagedRows key={`request:${selectedModel}`} items={requests} t={t} render={items => <RequestRows requests={items} t={t} />} />}
  </DetailPanel>
}

function RequestRows({ requests, t }: { requests: readonly UsageRequestRecord[]; t: BillingOverviewProps['t'] }) {
  const locale = t('locale.tag')
  return (
    <div className="dsh-billing-request-list">
      {requests.map(request => (
        <article className="dsh-billing-request-row" key={request.seq} data-billing-status={request.billingStatus}>
          <div>
            <div className="dsh-billing-request-meta"><span>{new Date(request.time).toLocaleString(locale)}</span><span className="dsh-billing-provider-tag">{request.provider ?? '?'}</span></div>
            <code className="dsh-billing-name" title={`${request.provider ?? '?'} / ${request.model ?? t('billing.unknownModel')}`}>{request.model ?? t('billing.unknownModel')}</code>
            {request.unknownReason !== undefined ? <small className="dsh-balance-secondary">{t(`billing.reason.${request.unknownReason}` as DshBalanceLocaleKey)}</small> : null}
          </div>
          <div>
            <TotalsCaption totals={request} t={t} />
            <strong>{request.billingStatus === 'free' ? t('billing.free' as DshBalanceLocaleKey) : request.billingStatus === 'unpriced' ? t('billing.notPriced') : request.costCny !== undefined ? amount(request.costCny, 'CNY', locale) : amount(request.costUsd, 'USD', locale)}</strong>
          </div>
        </article>
      ))}
    </div>
  )
}

function useUsageResult(loadUsage: UsageTabInjected['loadUsage'], options: UsageLoadOptions, revision: string) {
  const [state, setState] = useState<{ options: UsageLoadOptions; result: UsageApiResponse }>()
  const [loading, setLoading] = useState(true)
  const active = useRef<AbortController>()
  const load = useCallback(async (forceRefresh: boolean) => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    setLoading(true)
    try {
      const result = await loadUsage({ ...options, forceRefresh }, signal)
      if (!signal.aborted) setState({ options, result })
    } catch {
      if (!signal.aborted) setState({ options, result: { ok: false, code: 'UPSTREAM_UNAVAILABLE', message: '' } })
    } finally {
      if (!signal.aborted) setLoading(false)
      if (active.current === controller) active.current = undefined
    }
  }, [loadUsage, options])

  useEffect(() => {
    void load(false)
    const update = () => {
      if (globalThis.document?.visibilityState === 'hidden' || active.current !== undefined) return
      void load(false)
    }
    const interval = window.setInterval(update, 15_000)
    globalThis.document?.addEventListener('visibilitychange', update)
    window.addEventListener?.('focus', update)
    return () => {
      active.current?.abort()
      window.clearInterval(interval)
      globalThis.document?.removeEventListener('visibilitychange', update)
      window.removeEventListener?.('focus', update)
    }
  }, [load, revision])

  return { result: state?.options === options ? state.result : undefined, loading, refresh: () => { void load(true) } }
}

export function BillingOverview({ loadUsage, loadAdvice, t, provider }: BillingOverviewProps) {
  const [providerScope, setProviderScope] = useState<'selected' | 'all'>('selected')
  const selectedProvider = providerScope === 'all' ? undefined : provider
  const browserTimeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])
  const [timeZoneChoice, setTimeZoneChoice] = useState('browser')
  const timeZone = timeZoneChoice === 'browser' ? browserTimeZone : timeZoneChoice
  const [range, setRange] = useState<UsageRange>('all')
  const [custom, setCustom] = useState(() => ({ from: shiftDate(localDateKey(browserTimeZone), -29), to: localDateKey(browserTimeZone) }))
  const [day, setDay] = useState(() => localDateKey(browserTimeZone))
  useEffect(() => { setDay(localDateKey(timeZone)) }, [timeZone])
  useEffect(() => {
    const timer = window.setInterval(() => setDay(localDateKey(timeZone)), 15_000)
    return () => { window.clearInterval(timer) }
  }, [timeZone])
  const dates = useMemo(() => resolveUsageDates(range, custom, day), [range, custom, day])
  // An incomplete custom range must not spend a Host query on dates it cannot use.
  const customInvalid = range === 'custom' && dates === undefined
  const [filterProvider, setFilterProvider] = useState('')
  const queryProvider = provider === undefined ? filterProvider || undefined : selectedProvider
  const [drill, setDrill] = useState<string | undefined>()
  const [category, setCategory] = useState<UsageCategoryState>('model')
  const [localRate, setLocalRate] = useState(readStoredRate)

  const options = useMemo<UsageLoadOptions>(() => drill === undefined
    ? {
        scope: 'all',
        timeZone,
        ...(queryProvider === undefined ? {} : { provider: queryProvider }),
        ...(dates ?? {}),
      }
    // A drilled session shows its complete history; range and provider filters do not apply.
    : { scope: 'session', sessionId: drill, timeZone }, [drill, queryProvider, timeZone, dates])
  const load = useCallback<UsageTabInjected['loadUsage']>(async (query, signal) => (
    customInvalid && drill === undefined ? { ok: false, code: 'INVALID_REQUEST', message: '' } : loadUsage(query, signal)
  ), [loadUsage, customInvalid, drill])
  const { result, loading, refresh } = useUsageResult(load, options, JSON.stringify(options))
  // Bounded ranges compare against the immediately preceding period of equal length.
  const previousOptions = useMemo<UsageLoadOptions | undefined>(() => {
    if (drill !== undefined || !hasRange(dates)) return undefined
    const length = Math.round((Date.parse(`${dates.to}T12:00:00Z`) - Date.parse(`${dates.from}T12:00:00Z`)) / 86_400_000) + 1
    return { ...options, from: shiftDate(dates.from, -length), to: shiftDate(dates.to, -length) }
  }, [drill, dates, options])

  const knownProviders = useRef<string[]>([])
  if (result?.ok === true && queryProvider === undefined) knownProviders.current = result.summary.byProvider.map(item => item.provider)

  const hostRate = result?.ok === true ? result.summary.usdToCny : null
  const effectiveRate = hostRate ?? localRate
  const allResult = result?.ok === true && result.scope === 'all' ? result : undefined
  const sessionResult = result?.ok === true && result.scope === 'session' ? result : undefined

  const exportCurrent = (format: 'json' | 'csv') => {
    if (result?.ok !== true) return
    const stamp = new Date().toISOString().slice(0, 10)
    const mime = format === 'json' ? 'application/json' : 'text/csv'
    if (result.scope === 'session') {
      const text = format === 'json'
        ? sessionJson(result.session, result.summary, result.requests, { scope: 'session', timeZone })
        : sessionCsv(result.requests)
      downloadTextFile(`dsh-balance-session-${result.session.sessionId.slice(0, 8)}-${stamp}.${format}`, mime, text)
      return
    }
    const context = { scope: 'all' as const, timeZone, ...(queryProvider === undefined ? {} : { provider: queryProvider }), ...(dates ?? {}) }
    const text = format === 'json'
      ? overviewJson(result.summary, context)
      : overviewCsv(result.summary, category as UsageCategory)
    downloadTextFile(`dsh-balance-usage-${stamp}.${format}`, mime, text)
  }

  return (
    <section className="dsh-billing-section" aria-labelledby="dsh-billing-title">
      <div className="dsh-balance-summary">
        <div>
          <h2 id="dsh-billing-title" className="dsh-balance-heading">{drill === undefined ? t('billing.title') : t('billing.sessionDrillTitle')}</h2>
          <p className="dsh-balance-copy">{drill === undefined ? t('billing.copy', { timeZone }) : t('billing.sessionDrillCopy')}</p>
        </div>
        <div className="dsh-billing-actions">
          {drill === undefined ? <>
            {provider === undefined ? <Dropdown label={t('billing.provider')} value={filterProvider} onChange={setFilterProvider}
              options={[{ value: '', label: t('panel.allProviders') }, ...knownProviders.current.map(id => ({ value: id, label: findBalanceProvider(id)?.name ?? id }))]} />
              : <Dropdown label={t('billing.provider')} value={providerScope} onChange={setProviderScope} options={[
                { value: 'selected', label: findBalanceProvider(provider)?.name ?? provider },
                { value: 'all', label: t('panel.allProviders') },
              ]} />}
            <Dropdown label={t('billing.range')} value={range} onChange={setRange} options={[
              { value: 'today', label: t('billing.todayRange') }, { value: '7d', label: t('billing.sevenDays') },
              { value: '30d', label: t('billing.thirtyDays') }, { value: 'all', label: t('billing.allTime') },
              { value: 'custom', label: t('billing.customRange') },
            ]} />
            {range === 'custom' ? <span className="dsh-billing-dates">
              <input type="date" aria-label={t('billing.fromDate')} value={custom.from} max={custom.to || undefined}
                onChange={event => { setCustom(prev => ({ ...prev, from: event.target.value })) }} />
              <input type="date" aria-label={t('billing.toDate')} value={custom.to} min={custom.from || undefined}
                onChange={event => { setCustom(prev => ({ ...prev, to: event.target.value })) }} />
            </span> : null}
            <Dropdown label={t('billing.timeZone')} value={timeZoneChoice} onChange={setTimeZoneChoice} options={[
              { value: 'browser', label: `${t('billing.timeZoneBrowser')} · ${browserTimeZone}` },
              ...COMMON_TIME_ZONES.map(zone => ({ value: zone, label: zone })),
            ]} />
          </> : <button className="dsh-balance-refresh" type="button" aria-label={t('billing.backToOverview')} onClick={() => { setDrill(undefined) }}>
            <span aria-hidden="true">←</span> {t('billing.backToOverview')}
          </button>}
          <button className="dsh-balance-refresh" type="button" disabled={loading || result?.ok !== true} onClick={() => { exportCurrent('json') }}>
            {t('billing.exportJson')}
          </button>
          <button className="dsh-balance-refresh" type="button" disabled={loading || result?.ok !== true} onClick={() => { exportCurrent('csv') }}>
            {t('billing.exportCsv')}
          </button>
          <RateEditor value={effectiveRate} configured={hostRate !== null} onChange={value => { setLocalRate(value); writeStoredRate(value) }} t={t} />
          <button className="dsh-balance-refresh" type="button" aria-label={t('billing.refresh')} disabled={loading} onClick={refresh}>
            {loading ? t('action.loading') : t('billing.refresh')}
          </button>
        </div>
      </div>
      {customInvalid ? <p className="dsh-balance-error" role="alert">{t('billing.invalidRange')}</p> : null}
      {customInvalid ? null : <>
        {loading && result === undefined ? <p className="dsh-balance-status" role="status">{t('billing.loading')}</p> : null}
        {result !== undefined ? <ErrorMessage result={result} t={t} /> : null}
        {allResult !== undefined && (allResult.coverage?.skippedSessions ?? 0) > 0
          ? <p className="dsh-balance-status dsh-billing-coverage" role="status">{t('billing.skippedSessions', { count: allResult.coverage!.skippedSessions })}</p>
          : null}
        {allResult !== undefined ? <>
          <SummaryCards summary={allResult.summary} t={t} usdToCny={effectiveRate}
            comparison={previousOptions === undefined ? undefined
              : <PeriodComparison load={load} previousOptions={previousOptions} current={allResult} t={t} />} />
          <Punchcard summary={allResult.summary} t={t} />
          <UsageTables summary={allResult.summary} t={t} usdToCny={effectiveRate} category={category} onCategoryChange={setCategory} onSessionSelect={setDrill} />
          <p className="dsh-balance-meta">{t('billing.estimate')}</p>
          <p className="dsh-balance-meta">{t('meta.updated', { time: new Date(allResult.fetchedAt).toLocaleString(t('locale.tag')) })}{allResult.source === 'cache' ? t('meta.cached') : ''}</p>
        </> : null}
        {sessionResult !== undefined ? <>
          <SummaryCards summary={sessionResult.summary} t={t} usdToCny={effectiveRate} showProjection={false} />
          {loadAdvice === undefined ? null : <AdviceCard sessionId={sessionResult.session.sessionId} loadAdvice={loadAdvice} t={t} usdToCny={effectiveRate} />}
          <p className="dsh-balance-meta">{t('billing.estimate')}</p>
          <SessionDetails key={sessionResult.session.sessionId} result={sessionResult} t={t} usdToCny={effectiveRate} />
          <p className="dsh-balance-meta">{t('meta.updated', { time: new Date(sessionResult.fetchedAt).toLocaleString(t('locale.tag')) })}{sessionResult.source === 'cache' ? t('meta.cached') : ''}</p>
        </> : null}
      </>}
    </section>
  )
}

export function BillingView({ loadUsage, loadAdvice, sessionId, useSession, useProjection, t }: BillingViewProps) {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])
  const [localRate] = useState(readStoredRate)
  const running = useSession(snapshot => snapshot.running)
  const tokenUsage = useProjection('tokenUsage')
  const options = useMemo<UsageLoadOptions>(() => ({ scope: 'session', sessionId, timeZone }), [sessionId, timeZone])
  const { result, loading, refresh } = useUsageResult(loadUsage, options, `${sessionId}:${running}:${JSON.stringify(tokenUsage)}`)
  const sessionResult = result?.ok === true && result.scope === 'session' ? result as UsageSessionSuccess : undefined
  const hostRate = result?.ok === true ? result.summary.usdToCny : null
  const effectiveRate = hostRate ?? localRate

  return (
    <section className="dsh-billing-view" aria-labelledby="dsh-billing-view-title">
      <div className="dsh-balance-summary">
        <div>
          <h2 id="dsh-billing-view-title" className="dsh-balance-heading">{t('billing.sessionTitle')}</h2>
          <p className="dsh-balance-copy">{t('billing.sessionCopy')}</p>
        </div>
        <button className="dsh-balance-refresh" type="button" aria-label={t('billing.refresh')} disabled={loading} onClick={refresh}>
          {loading ? t('action.loading') : t('billing.refresh')}
        </button>
      </div>
      {loading && result === undefined ? <p className="dsh-balance-status" role="status">{t('billing.loading')}</p> : null}
      {result !== undefined ? <ErrorMessage result={result} t={t} /> : null}
      {sessionResult !== undefined ? <>
        <SummaryCards summary={sessionResult.summary} t={t} usdToCny={effectiveRate} showProjection={false} />
        {loadAdvice === undefined ? null : <AdviceCard sessionId={sessionId} loadAdvice={loadAdvice} t={t} usdToCny={effectiveRate} />}
        <p className="dsh-balance-meta">{t('billing.estimate')}</p>
        <SessionDetails key={sessionId} result={sessionResult} t={t} usdToCny={effectiveRate} />
        <p className="dsh-balance-meta">{t('meta.updated', { time: new Date(sessionResult.fetchedAt).toLocaleString(t('locale.tag')) })}{sessionResult.source === 'cache' ? t('meta.cached') : ''}</p>
      </> : null}
    </section>
  )
}
