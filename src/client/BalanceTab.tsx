import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceApiResponse, BalanceHistoryPoint, BalanceInfo } from '../types.ts'
import { findBalanceProvider } from '../providers.ts'
import type { BalanceProviderId } from '../providers.ts'
import { displayAmount } from './format.ts'
import { errorLocaleKey } from './locales.ts'
import type { DshBalanceLocaleKey, LOCALE_NS } from './locales.ts'

export interface BalanceTabInjected {
  loadBalance: (forceRefresh: boolean, signal: AbortSignal, provider?: BalanceProviderId) => Promise<BalanceApiResponse>
}

export type BalanceTabProps = BalanceTabInjected & PropsLocale<typeof LOCALE_NS> & { provider?: BalanceProviderId }

/** Minimal oldest-to-newest trend line; the current amount stays the readable value. */
function BalanceSparkline({ values }: { values: number[] }) {
  const width = 100
  const height = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const points = values.map((value, index) => ({
    x: values.length === 1 ? width : (index / (values.length - 1)) * width,
    y: span === 0 ? height / 2 : height - 2 - ((value - min) / span) * (height - 4),
  }))
  const last = points.at(-1)!
  return (
    <svg className="dsh-balance-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')} />
      <circle cx={last.x.toFixed(2)} cy={last.y.toFixed(2)} r={2} />
    </svg>
  )
}

function BalanceCard({ info, history, t }: { info: BalanceInfo; history?: BalanceHistoryPoint[] | undefined; t: BalanceTabProps['t'] }) {
  const available: [DshBalanceLocaleKey, string | undefined][] = [
    ['balance.toppedUp', info.toppedUpBalance],
    ['balance.granted', info.grantedBalance],
  ]
  const cumulative: [DshBalanceLocaleKey, string | undefined][] = [
    ['balance.totalCash', info.totalCashBalance],
    ['balance.totalVoucher', info.totalVoucherBalance],
  ]
  const renderRows = (rows: [DshBalanceLocaleKey, string | undefined][]) => rows
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => (
      <div key={label}><dt>{t(label)}</dt><dd>{displayAmount(value!, info.currency, t('locale.tag'))}</dd></div>
    ))
  const series = (history ?? [])
    .map(point => point.balances.find(row => row.currency === info.currency))
    .filter((row): row is { currency: string; totalBalance: string } => row !== undefined)
    .map(row => Number(row.totalBalance))
    .filter(value => Number.isFinite(value))
  return (
    <article className="dsh-balance-card">
      <div className="dsh-balance-card-head">
        <span>{t('balance.availableAmount')}</span><span className="dsh-balance-currency">{info.currency}</span>
      </div>
      <p className="dsh-balance-total">{displayAmount(info.totalBalance, info.currency, t('locale.tag'))}</p>
      {series.length >= 2 ? <BalanceSparkline values={series} /> : null}
      {available.some(([, value]) => value !== undefined) ? <dl className="dsh-balance-breakdown">{renderRows(available)}</dl> : null}
      {cumulative.some(([, value]) => value !== undefined) ? (
        <div>
          <p className="dsh-balance-copy">{t('balance.totalsNote')}</p>
          <dl className="dsh-balance-breakdown">{renderRows(cumulative)}</dl>
        </div>
      ) : null}
    </article>
  )
}

export function BalanceSection({ loadBalance, t, provider = 'deepseek' }: BalanceTabProps) {
  const [result, setResult] = useState<BalanceApiResponse>()
  const [loading, setLoading] = useState(true)
  const active = useRef<AbortController>()
  const providerName = findBalanceProvider(provider)!.name

  const load = useCallback(async (forceRefresh: boolean) => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const { signal } = controller
    setLoading(true)
    try {
      const value = await loadBalance(forceRefresh, signal, provider)
      if (!signal.aborted) setResult(value)
    } catch {
      if (!signal.aborted) setResult({ ok: false, code: 'UPSTREAM_UNAVAILABLE', message: '' })
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [loadBalance, provider])

  useEffect(() => {
    setResult(undefined)
    void load(false)
    return () => { active.current?.abort() }
  }, [load])

  return (
    <section className="dsh-balance-section" aria-labelledby="dsh-balance-title" aria-busy={loading} data-provider={provider}>
      <div className="dsh-balance-summary">
        <div>
          <p className="dsh-ledger-kicker">01 / {t('panel.account')}</p>
          <h2 id="dsh-balance-title" className="dsh-balance-heading">{t('balance.title', { provider: providerName })}</h2>
        </div>
        <button className="dsh-balance-refresh" type="button" disabled={loading} onClick={() => { void load(true) }}>
          <span aria-hidden="true">↻</span> {loading ? t('action.loading') : t('balance.refresh')}
        </button>
      </div>
      {loading && result === undefined ? <div className="dsh-balance-skeleton" role="status"><span>{t('balance.loading')}</span><i /><i /></div> : null}
      {result?.ok === false ? (
        <div className="dsh-balance-error" role="alert">
          <strong>{providerName} / {t(errorLocaleKey(result.code))}</strong>
          {result.code === 'MISSING_API_KEY' ? <p>{t(provider === 'deepseek' ? 'balance.setupDeepSeek' : 'balance.setup', { provider: providerName, ref: findBalanceProvider(provider)!.apiKeyRef })}</p> : null}
        </div>
      ) : null}
      {result?.ok === true ? (
        <>
          <div className="dsh-balance-availability" data-available={String(result.isAvailable)}>
            <span className="dsh-balance-dot" aria-hidden="true" />
            <span>{result.accountType !== undefined ? t(`balance.${result.accountType}`) : t(result.isAvailable ? 'balance.available' : 'balance.unavailable')}</span>
          </div>
          {result.lowBalance !== undefined && result.lowBalance.length > 0 ? (
            <p className="dsh-balance-status dsh-billing-coverage" role="status">
              <strong>{t('balance.lowBalance')}</strong>
              {result.lowBalance.map(breach => (
                <span className="dsh-balance-secondary" key={breach.currency}> {t('balance.lowBalanceDetail', {
                  currency: breach.currency,
                  balance: displayAmount(breach.totalBalance, breach.currency, t('locale.tag')),
                  amount: displayAmount(String(breach.amount), breach.currency, t('locale.tag')),
                })}</span>
              ))}
            </p>
          ) : null}
          {result.balanceInfos.length > 0
            ? <div className="dsh-balance-grid">{result.balanceInfos.map(info => <BalanceCard key={info.currency} info={info} history={result.history} t={t} />)}</div>
            : <p className="dsh-balance-status">{t('balance.empty')}</p>}
          <div className="dsh-balance-footer"><p className="dsh-balance-meta">
            {t('meta.updated', { time: new Date(result.fetchedAt).toLocaleString(t('locale.tag')) })}{result.source === 'cache' ? t('meta.cached') : ''}
          </p><span>{t('panel.private')}</span></div>
        </>
      ) : null}
    </section>
  )
}

/** @deprecated The balance view is no longer rendered as a Plugins tab. */
export const BalanceTab = BalanceSection
