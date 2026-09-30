import type {} from '@deepseek-ai/dsh-token-meter/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { displayAmount } from './format.ts'
import type { DshBalanceLocaleKey, LOCALE_NS } from './locales.ts'

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
}

export type BillingOverviewProps = UsageTabInjected & PropsLocale<typeof LOCALE_NS> & { provider?: string }
export type BillingViewProps = PropsRuntime<'conversation.view'> & InjectFace<UsageTabInjected> & PropsLocale<typeof LOCALE_NS>

function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
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

function dateDaysAgo(timeZone: string, days: number): string {
  const local = new Date(`${localDateKey(timeZone)}T12:00:00Z`)
  local.setUTCDate(local.getUTCDate() - days)
  return local.toISOString().slice(0, 10)
}

function totalForDay(summary: UsageSummary, date: string): UsageTotals {
  return summary.byDay.find(item => item.date === date) ?? {
    requests: 0,
    pricedRequests: 0,
    unpricedRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    costCny: summary.usdToCny === null ? null : 0,
    nativeCostCny: 0,
    cnyPricedRequests: 0,
  }
}

function ErrorMessage({ result, t }: { result: UsageApiResponse; t: BillingOverviewProps['t'] }) {
  if (result.ok === true) return null
  const key = `billing.error.${result.code}` as DshBalanceLocaleKey
  return <p className="dsh-balance-error" role="alert">{t(key)}{result.message ? ` (${result.message})` : ''}</p>
}

function CostLabel({ totals, t, preferCny = false }: { totals: UsageTotals; t: BillingOverviewProps['t']; preferCny?: boolean }) {
  const locale = t('locale.tag')
  const unpriced = totals.requests > 0 && totals.pricedRequests === 0
  const cnyOnly = totals.cnyPricedRequests > 0 && totals.pricedRequests === totals.cnyPricedRequests || totals.requests === 0 && preferCny
  const mixed = totals.cnyPricedRequests > 0 && !cnyOnly
  return (
    <div className="dsh-billing-cost-value">
      <strong>{unpriced ? t('billing.notPriced') : cnyOnly ? amount(totals.nativeCostCny, 'CNY', locale) : amount(totals.costUsd, 'USD', locale)}</strong>
      {mixed ? <span>{amount(totals.nativeCostCny, 'CNY', locale)} {t('billing.nativeCny')}</span> : null}
      {totals.unpricedRequests > 0 && !unpriced ? <small>{t('billing.partial')}</small> : null}
      {totals.costCny !== null && !unpriced && !cnyOnly && totals.costCny !== totals.nativeCostCny ? <span>{amount(totals.costCny, 'CNY', locale)} {t('billing.fixedRate')}</span> : null}
    </div>
  )
}

function SummaryCards({ summary, t }: { summary: UsageSummary; t: BillingOverviewProps['t'] }) {
  const today = totalForDay(summary, localDateKey(summary.timeZone))
  return (
    <div className="dsh-billing-card-grid">
      <article className="dsh-billing-card dsh-billing-card-primary">
        <span>{t('billing.totalCost')}</span>
        <CostLabel totals={summary.totals} t={t} />
        <small>{t('billing.pricedRequests', { count: summary.totals.pricedRequests })}</small>
      </article>
      <article className="dsh-billing-card">
        <span>{t('billing.todayCost')}</span>
        <CostLabel totals={today} t={t} preferCny={summary.totals.cnyPricedRequests > 0 && summary.totals.pricedRequests === summary.totals.cnyPricedRequests} />
        <small>{t('billing.today', { date: localDateKey(summary.timeZone) })}</small>
      </article>
      <article className="dsh-billing-card">
        <span>{t('billing.tokens')}</span>
        <strong>{formatTokens(summary.totals.inputTokens + summary.totals.outputTokens + summary.totals.cacheReadTokens + summary.totals.cacheWriteTokens)}</strong>
        <TotalsCaption totals={summary.totals} t={t} />
        <small>{t('billing.requestCount', { count: summary.totals.requests })}</small>
      </article>
      <article className="dsh-billing-card" data-warning={summary.totals.unpricedRequests > 0 ? 'true' : 'false'}>
        <span>{t('billing.unpriced')}</span>
        <strong>{formatTokens(summary.totals.unpricedRequests)}</strong>
        <small>{t('billing.unpricedHint')}</small>
      </article>
    </div>
  )
}

function TotalsCaption({ totals, t }: { totals: Pick<UsageTotals, 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens'>; t: BillingOverviewProps['t'] }) {
  return <span className="dsh-billing-token-caption">
    <span>{t('billing.inputShort')} <b>{formatTokens(totals.inputTokens)}</b></span>
    <span>{t('billing.outputShort')} <b>{formatTokens(totals.outputTokens)}</b></span>
    <span>{t('billing.cacheReadShort')} <b>{formatTokens(totals.cacheReadTokens)}</b></span>
    {totals.cacheWriteTokens > 0 ? <span>{t('billing.cacheWriteShort')} <b>{formatTokens(totals.cacheWriteTokens)}</b></span> : null}
  </span>
}

function ModelRows({ summary, items = summary.byModel, t }: { summary: UsageSummary; items?: readonly UsageSummary['byModel'][number][]; t: BillingOverviewProps['t'] }) {
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
          <CostLabel totals={item} t={t} />
          <small>{t('billing.requestCount', { count: item.requests })}{item.pricedRequests > item.cnyPricedRequests && summary.totals.costUsd > 0 ? ` · ${t('billing.share', { percent: `${Math.round(item.costUsd / summary.totals.costUsd * 100)}%` })}` : ''}</small>
        </div>
      </article>
    ))}
  </div>
}

function AggregateRows({ items, t }: { items: readonly { key: string; title: string; totals: UsageTotals }[]; t: BillingOverviewProps['t'] }) {
  return <div className="dsh-billing-list">
    {items.length === 0 ? <p className="dsh-balance-status">{t('billing.empty')}</p> : items.map(item => (
      <article className="dsh-billing-list-row" key={item.key}>
        <div className="dsh-billing-row-main"><span className="dsh-billing-session-title" title={item.title}>{item.title}</span><TotalsCaption totals={item.totals} t={t} /></div>
        <div className="dsh-billing-list-value"><CostLabel totals={item.totals} t={t} /><small>{t('billing.requestCount', { count: item.totals.requests })}</small></div>
      </article>
    ))}
  </div>
}

function UsageTables({ summary, t }: { summary: UsageSummary; t: BillingOverviewProps['t'] }) {
  const [category, setCategory] = useState<'model' | 'provider' | 'session' | 'day'>('model')
  const rows: { key: string; title: string; totals: UsageTotals }[] = category === 'provider' ? summary.byProvider.map(item => ({ key: item.provider, title: findBalanceProvider(item.provider)?.name ?? item.provider, totals: item }))
    : category === 'session' ? summary.bySession.map(item => ({ key: item.sessionId, title: item.title, totals: item }))
      : summary.byDay.map(item => ({ key: item.date, title: item.date, totals: item }))
  return <DetailPanel label={t('billing.categories')} value={category} onChange={setCategory} tabs={[
    { value: 'model', label: t('billing.modelsLabel'), count: summary.byModel.length },
    { value: 'provider', label: t('billing.providersLabel'), count: summary.byProvider.length },
    { value: 'session', label: t('billing.sessionsLabel'), count: summary.bySession.length },
    { value: 'day', label: t('billing.daysLabel'), count: summary.byDay.length },
  ]}>
    {category === 'model'
      ? <PagedRows key="model" items={summary.byModel} t={t} render={items => <ModelRows items={items} summary={summary} t={t} />} />
      : <PagedRows key={category} items={rows} t={t} render={items => <AggregateRows items={items} t={t} />} />}
  </DetailPanel>
}

function SessionDetails({ result, t }: { result: UsageSessionSuccess; t: BillingOverviewProps['t'] }) {
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
      ? <PagedRows key="model" items={result.summary.byModel} t={t} render={items => <ModelRows items={items} summary={result.summary} t={t} />} />
      : <PagedRows key={`request:${selectedModel}`} items={requests} t={t} render={items => <RequestRows requests={items} t={t} />} />}
  </DetailPanel>
}

function RequestRows({ requests, t }: { requests: readonly UsageRequestRecord[]; t: BillingOverviewProps['t'] }) {
  const locale = t('locale.tag')
  return (
    <div className="dsh-billing-request-list">
      {requests.map(request => (
        <article className="dsh-billing-request-row" key={request.seq}>
          <div>
            <div className="dsh-billing-request-meta"><span>{new Date(request.time).toLocaleString(locale)}</span><span className="dsh-billing-provider-tag">{request.provider ?? '?'}</span></div>
            <code className="dsh-billing-name" title={`${request.provider ?? '?'} / ${request.model ?? t('billing.unknownModel')}`}>{request.model ?? t('billing.unknownModel')}</code>
            {request.unknownReason !== undefined ? <small className="dsh-billing-secondary">{t(`billing.reason.${request.unknownReason}` as DshBalanceLocaleKey)}</small> : null}
          </div>
          <div>
            <TotalsCaption totals={request} t={t} />
            <strong>{request.costCny !== undefined ? amount(request.costCny, 'CNY', locale) : request.costUsd === null ? t('billing.notPriced') : amount(request.costUsd, 'USD', locale)}</strong>
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

export function BillingOverview({ loadUsage, t, provider }: BillingOverviewProps) {
  const [providerScope, setProviderScope] = useState<'selected' | 'all'>('selected')
  const selectedProvider = providerScope === 'all' ? undefined : provider
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'all'>('all')
  const [filterProvider, setFilterProvider] = useState('')
  const queryProvider = provider === undefined ? filterProvider || undefined : selectedProvider
  const [day, setDay] = useState(() => localDateKey(timeZone))
  useEffect(() => {
    const timer = window.setInterval(() => setDay(localDateKey(timeZone)), 15_000)
    return () => window.clearInterval(timer)
  }, [timeZone])
  const options = useMemo<UsageLoadOptions>(() => ({
    scope: 'all',
    ...(queryProvider === undefined ? {} : { provider: queryProvider }),
    timeZone,
    ...(range === 'all' ? {} : {
      from: range === 'today' ? day : dateDaysAgo(timeZone, range === '7d' ? 6 : 29),
      to: day,
    }),
  }), [range, timeZone, queryProvider, day])
  const { result, loading, refresh } = useUsageResult(loadUsage, options, JSON.stringify(options))

  const knownProviders = useRef<string[]>([])
  if (result?.ok === true && queryProvider === undefined) knownProviders.current = result.summary.byProvider.map(item => item.provider)

  return (
    <section className="dsh-billing-section" aria-labelledby="dsh-billing-title">
      <div className="dsh-balance-summary">
        <div>
          <h2 id="dsh-billing-title" className="dsh-balance-heading">{t('billing.title')}</h2>
          <p className="dsh-balance-copy">{t('billing.copy', { timeZone })}</p>
        </div>
        <div className="dsh-billing-actions">
          {provider === undefined ? <Dropdown label={t('billing.provider')} value={filterProvider} onChange={setFilterProvider}
            options={[{ value: '', label: t('panel.allProviders') }, ...knownProviders.current.map(id => ({ value: id, label: findBalanceProvider(id)?.name ?? id }))]} />
            : <Dropdown label={t('billing.provider')} value={providerScope} onChange={setProviderScope} options={[
              { value: 'selected', label: findBalanceProvider(provider)?.name ?? provider },
              { value: 'all', label: t('panel.allProviders') },
            ]} />}
          <Dropdown label={t('billing.range')} value={range} onChange={setRange} options={[
            { value: 'today', label: t('billing.todayRange') }, { value: '7d', label: t('billing.sevenDays') },
            { value: '30d', label: t('billing.thirtyDays') }, { value: 'all', label: t('billing.allTime') },
          ]} />
          <button className="dsh-balance-refresh" type="button" disabled={loading} onClick={refresh}>
            {loading ? t('action.loading') : t('billing.refresh')}
          </button>
        </div>
      </div>
      {loading && result === undefined ? <p className="dsh-balance-status" role="status">{t('billing.loading')}</p> : null}
      {result !== undefined ? <ErrorMessage result={result} t={t} /> : null}
      {result?.ok === true && result.scope === 'all' && (result.coverage?.skippedSessions ?? 0) > 0
        ? <p className="dsh-balance-status dsh-billing-coverage" role="status">{t('billing.skippedSessions', { count: result.coverage!.skippedSessions })}</p>
        : null}
      {result?.ok === true && result.scope === 'all' ? <><SummaryCards summary={result.summary} t={t} /><Punchcard summary={result.summary} t={t} /><UsageTables summary={result.summary} t={t} /><p className="dsh-balance-meta">{t('billing.estimate')}</p><p className="dsh-balance-meta">{t('meta.updated', { time: new Date(result.fetchedAt).toLocaleString(t('locale.tag')) })}{result.source === 'cache' ? t('meta.cached') : ''}</p></> : null}
    </section>
  )
}

export function BillingView({ loadUsage, sessionId, useSession, useProjection, t }: BillingViewProps) {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])
  const running = useSession(snapshot => snapshot.running)
  const tokenUsage = useProjection('tokenUsage')
  const options = useMemo<UsageLoadOptions>(() => ({ scope: 'session', sessionId, timeZone }), [sessionId, timeZone])
  const { result, loading, refresh } = useUsageResult(loadUsage, options, `${sessionId}:${running}:${JSON.stringify(tokenUsage)}`)
  const sessionResult = result?.ok === true && result.scope === 'session' ? result as UsageSessionSuccess : undefined

  return (
    <section className="dsh-billing-view" aria-labelledby="dsh-billing-view-title">
      <div className="dsh-balance-summary">
        <div>
          <h2 id="dsh-billing-view-title" className="dsh-balance-heading">{t('billing.sessionTitle')}</h2>
          <p className="dsh-balance-copy">{t('billing.sessionCopy')}</p>
        </div>
        <button className="dsh-balance-refresh" type="button" disabled={loading} onClick={refresh}>
          {loading ? t('action.loading') : t('billing.refresh')}
        </button>
      </div>
      {loading && result === undefined ? <p className="dsh-balance-status" role="status">{t('billing.loading')}</p> : null}
      {result !== undefined ? <ErrorMessage result={result} t={t} /> : null}
      {sessionResult !== undefined ? <>
        <SummaryCards summary={sessionResult.summary} t={t} />
        <p className="dsh-balance-meta">{t('billing.estimate')}</p>
        <SessionDetails key={sessionId} result={sessionResult} t={t} />
        <p className="dsh-balance-meta">{t('meta.updated', { time: new Date(sessionResult.fetchedAt).toLocaleString(t('locale.tag')) })}{sessionResult.source === 'cache' ? t('meta.cached') : ''}</p>
      </> : null}
    </section>
  )
}
