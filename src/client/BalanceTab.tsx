import { useCallback, useEffect, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceApiResponse, BalanceInfo } from '../types.ts'
import { displayAmount } from './format.ts'
import { errorLocaleKey } from './locales.ts'
import type { LOCALE_NS } from './locales.ts'

export interface BalanceTabInjected {
  loadBalance: (forceRefresh: boolean, signal: AbortSignal) => Promise<BalanceApiResponse>
}

export type BalanceTabProps = BalanceTabInjected & PropsLocale<typeof LOCALE_NS>

function BalanceCard({ info, t }: { info: BalanceInfo; t: BalanceTabProps['t'] }) {
  return (
    <article className="dsh-balance-card">
      <div className="dsh-balance-card-head">
        <span className="dsh-balance-currency">{info.currency}</span>
      </div>
      <p className="dsh-balance-total">{displayAmount(info.totalBalance, info.currency, t('locale.tag'))}</p>
      <dl className="dsh-balance-breakdown">
        <dt>{t('balance.toppedUp')}</dt>
        <dd>{displayAmount(info.toppedUpBalance, info.currency, t('locale.tag'))}</dd>
        <dt>{t('balance.granted')}</dt>
        <dd>{displayAmount(info.grantedBalance, info.currency, t('locale.tag'))}</dd>
      </dl>
    </article>
  )
}

export function BalanceSection({ loadBalance, t }: BalanceTabProps) {
  const [result, setResult] = useState<BalanceApiResponse>()
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (forceRefresh: boolean, signal: AbortSignal) => {
    setLoading(true)
    try {
      setResult(await loadBalance(forceRefresh, signal))
    } catch (error) {
      if (signal.aborted) return
      setResult({
        ok: false,
        code: 'UPSTREAM_UNAVAILABLE',
        message: error instanceof Error ? error.message : '',
      })
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [loadBalance])

  useEffect(() => {
    const controller = new AbortController()
    void load(false, controller.signal)
    return () => { controller.abort() }
  }, [load])

  const refresh = () => {
    const controller = new AbortController()
    void load(true, controller.signal)
  }

  return (
    <section className="dsh-balance-section" aria-labelledby="dsh-balance-title">
      <div className="dsh-balance-summary">
        <div>
          <h2 id="dsh-balance-title" className="dsh-balance-heading">{t('balance.title')}</h2>
          <p className="dsh-balance-copy">{t('balance.copy')}</p>
        </div>
        <button className="dsh-balance-refresh" type="button" disabled={loading} onClick={refresh}>
          {loading ? t('action.loading') : t('balance.refresh')}
        </button>
      </div>

      {loading && result === undefined ? <p className="dsh-balance-status" role="status">{t('balance.loading')}</p> : null}
      {result?.ok === false ? <p className="dsh-balance-error" role="alert">{t(errorLocaleKey(result.code))}</p> : null}
      {result?.ok === true ? (
        <>
          <div className="dsh-balance-availability" data-available={String(result.isAvailable)}>
            <span className="dsh-balance-dot" aria-hidden="true" />
            <span>{t(result.isAvailable ? 'balance.available' : 'balance.unavailable')}</span>
          </div>
          {result.balanceInfos.length > 0
            ? <div className="dsh-balance-grid">{result.balanceInfos.map(info => <BalanceCard key={info.currency} info={info} t={t} />)}</div>
            : <p className="dsh-balance-status">{t('balance.empty')}</p>}
          <p className="dsh-balance-meta">
            {t('meta.updated', { time: new Date(result.fetchedAt).toLocaleString(t('locale.tag')) })}{result.source === 'cache' ? t('meta.cached') : ''}
          </p>
        </>
      ) : null}
    </section>
  )
}

/** @deprecated The balance view is no longer rendered as a Plugins tab. */
export const BalanceTab = BalanceSection
