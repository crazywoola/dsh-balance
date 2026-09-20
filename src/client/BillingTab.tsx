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
  }
}

function ErrorMessage({ result, t }: { result: UsageApiResponse; t: BillingOverviewProps['t'] }) {
  if (result.ok === true) return null
  const key = `billing.error.${result.code}` as DshBalanceLocaleKey
  return <p className="dsh-balance-error" role="alert">{t(key)}{result.message ? ` (${result.message})` : ''}</p>
}

function CostLabel({ totals, t }: { totals: UsageTotals; t: BillingOverviewProps['t'] }) {
  const locale = t('locale.tag')
  const unpriced = totals.requests > 0 && totals.pricedRequests === 0
  return (
    <div className="dsh-billing-cost-value">
      <strong>{unpriced ? t('billing.notPriced') : amount(totals.costUsd, 'USD', locale)}</strong>
      {totals.unpricedRequests > 0 && !unpriced ? <small>{t('billing.partial')}</small> : null}
      {totals.costCny !== null && !unpriced ? <span>{amount(totals.costCny, 'CNY', locale)} {t('billing.fixedRate')}</span> : null}
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
        <CostLabel totals={today} t={t} />
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

function TotalsCaption({ totals, t }: { totals: UsageTotals; t: BillingOverviewProps['t'] }) {
  return <span className="dsh-billing-secondary">{t('billing.tokensBreakdown', {
    input: formatTokens(totals.inputTokens),
    output: formatTokens(totals.outputTokens),
    cacheHit: formatTokens(totals.cacheReadTokens),
    cacheWrite: formatTokens(totals.cacheWriteTokens),
  })}</span>
}

function ModelRows({ summary, t }: { summary: UsageSummary; t: BillingOverviewProps['t'] }) {
  return <div className="dsh-billing-list">
    {summary.byModel.length === 0 ? <p className="dsh-balance-status">{t('billing.empty')}</p> : summary.byModel.map(item => (
      <article className="dsh-billing-list-row" key={JSON.stringify([item.provider, item.model])}>
        <div>
          <code>{item.provider}/{item.model}</code>
          <TotalsCaption totals={item} t={t} />
        </div>
        <div className="dsh-billing-list-value">
          <CostLabel totals={item} t={t} />
          <small>{t('billing.requestCount', { count: item.requests })}{item.pricedRequests > 0 && summary.totals.costUsd > 0 ? ` · ${t('billing.share', { percent: `${Math.round(item.costUsd / summary.totals.costUsd * 100)}%` })}` : ''}</small>
        </div>
      </article>
    ))}
  </div>
}

function UsageTables({ summary, t }: { summary: UsageSummary; t: BillingOverviewProps['t'] }) {
  return (
    <div className="dsh-billing-table-grid">
      <section className="dsh-billing-list-section">
        <h3>{t('billing.byModel')}</h3>
        <ModelRows summary={summary} t={t} />
      </section>
      <section className="dsh-billing-list-section">
        <h3>{t('billing.bySession')}</h3>
        {summary.bySession.length === 0 ? <p className="dsh-balance-status">{t('billing.empty')}</p> : (
          <div className="dsh-billing-list">
            {summary.bySession.map(item => (
              <article className="dsh-billing-list-row" key={item.sessionId}>
                <div>
                  <span className="dsh-billing-session-title">{item.title}</span>
                  <TotalsCaption totals={item} t={t} />
                </div>
                <div className="dsh-billing-list-value">
                  <CostLabel totals={item} t={t} />
                  <small>{t('billing.requestCount', { count: item.requests })}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="dsh-billing-list-section dsh-billing-list-wide">
        <h3>{t('billing.byDay')}</h3>
        {summary.byDay.length === 0 ? <p className="dsh-balance-status">{t('billing.empty')}</p> : (
          <div className="dsh-billing-list">
            {summary.byDay.map(item => (
              <article className="dsh-billing-list-row" key={item.date}>
                <div>
                  <span className="dsh-billing-session-title">{item.date}</span>
                  <TotalsCaption totals={item} t={t} />
                </div>
                <div className="dsh-billing-list-value">
                  <CostLabel totals={item} t={t} />
                  <small>{t('billing.requestCount', { count: item.requests })}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function RequestRows({ requests, t }: { requests: readonly UsageRequestRecord[]; t: BillingOverviewProps['t'] }) {
  const locale = t('locale.tag')
  return (
    <div className="dsh-billing-request-list">
      {requests.map(request => (
        <article className="dsh-billing-request-row" key={`${request.turn}:${request.step}:${request.time}`}>
          <div>
            <span>{new Date(request.time).toLocaleString(locale)}</span>
            <code>{request.provider ?? '?'} / {request.model ?? t('billing.unknownModel')}</code>
            {request.unknownReason !== undefined ? <small className="dsh-billing-secondary">{t(`billing.reason.${request.unknownReason}` as DshBalanceLocaleKey)}</small> : null}
          </div>
          <div>
            <span>{t('billing.inputOutput', { input: formatTokens(request.inputTokens), output: formatTokens(request.outputTokens) })}</span>
            <small className="dsh-billing-secondary">{t('billing.tokensBreakdown', {
              input: formatTokens(request.inputTokens),
              output: formatTokens(request.outputTokens),
              cacheHit: formatTokens(request.cacheReadTokens),
              cacheWrite: formatTokens(request.cacheWriteTokens),
            })}</small>
            <strong>{request.costUsd === null ? t('billing.notPriced') : amount(request.costUsd, 'USD', locale)}</strong>
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
    }
  }, [loadUsage, options])

  useEffect(() => {
    void load(false)
    return () => { active.current?.abort() }
  }, [load, revision])

  return { result: state?.options === options ? state.result : undefined, loading, refresh: () => { void load(true) } }
}

export function BillingOverview({ loadUsage, t, provider }: BillingOverviewProps) {
  const [providerScope, setProviderScope] = useState<'selected' | 'all'>('selected')
  const selectedProvider = providerScope === 'all' ? undefined : provider
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'all'>('30d')
  const options = useMemo<UsageLoadOptions>(() => ({
    scope: 'all',
    ...(selectedProvider === undefined ? {} : { provider: selectedProvider }),
    timeZone,
    ...(range === 'all' ? {} : {
      from: range === 'today' ? localDateKey(timeZone) : dateDaysAgo(timeZone, range === '7d' ? 6 : 29),
      to: localDateKey(timeZone),
    }),
  }), [range, timeZone, selectedProvider])
  const { result, loading, refresh } = useUsageResult(loadUsage, options, JSON.stringify(options))

  return (
    <section className="dsh-billing-section" aria-labelledby="dsh-billing-title">
      <div className="dsh-balance-summary">
        <div>
          <h2 id="dsh-billing-title" className="dsh-balance-heading">{t('billing.title')}</h2>
          <p className="dsh-balance-copy">{t('billing.copy', { timeZone })}</p>
        </div>
        <div className="dsh-billing-actions">
          {provider === undefined ? null : <select aria-label={t('billing.provider')} value={providerScope} onChange={event => setProviderScope(event.target.value as typeof providerScope)}>
            <option value="selected">{findBalanceProvider(provider)?.name ?? provider}</option>
            <option value="all">{t('panel.allProviders')}</option>
          </select>}
          <select aria-label={t('billing.range')} value={range} onChange={event => setRange(event.target.value as typeof range)}>
            <option value="today">{t('billing.todayRange')}</option>
            <option value="7d">{t('billing.sevenDays')}</option>
            <option value="30d">{t('billing.thirtyDays')}</option>
            <option value="all">{t('billing.allTime')}</option>
          </select>
          <button className="dsh-balance-refresh" type="button" disabled={loading} onClick={refresh}>
            {loading ? t('action.loading') : t('billing.refresh')}
          </button>
        </div>
      </div>
      {loading && result === undefined ? <p className="dsh-balance-status" role="status">{t('billing.loading')}</p> : null}
      {result !== undefined ? <ErrorMessage result={result} t={t} /> : null}
      {result?.ok === true && result.scope === 'all' ? <><SummaryCards summary={result.summary} t={t} /><UsageTables summary={result.summary} t={t} /><p className="dsh-balance-meta">{t('meta.updated', { time: new Date(result.fetchedAt).toLocaleString(t('locale.tag')) })}{result.source === 'cache' ? t('meta.cached') : ''}</p></> : null}
    </section>
  )
}

export function BillingView({ loadUsage, sessionId, useSession, t }: BillingViewProps) {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', [])
  const lastAssistant = useSession(snapshot => {
    for (let index = snapshot.nodes.length - 1; index >= 0; index -= 1) {
      const node = snapshot.nodes[index]
      if (node?.kind === 'assistant') return `${node.seq}:${node.time}`
    }
    return 'empty'
  })
  const options = useMemo<UsageLoadOptions>(() => ({ scope: 'session', sessionId, timeZone }), [sessionId, timeZone])
  const { result, loading, refresh } = useUsageResult(loadUsage, options, `${sessionId}:${lastAssistant}`)
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
        <section className="dsh-billing-list-section">
          <h3>{t('billing.byModel')}</h3>
          <ModelRows summary={sessionResult.summary} t={t} />
        </section>
        <section className="dsh-billing-session-breakdown">
          <h3>{t('billing.requestDetails')}</h3>
          <RequestRows requests={sessionResult.requests} t={t} />
        </section>
        <p className="dsh-balance-meta">{t('meta.updated', { time: new Date(sessionResult.fetchedAt).toLocaleString(t('locale.tag')) })}{sessionResult.source === 'cache' ? t('meta.cached') : ''}</p>
      </> : null}
    </section>
  )
}
