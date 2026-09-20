import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceApiResponse, BalanceInfo } from '../types.ts'
import { findBalanceProvider } from '../providers.ts'
import type { BalanceProviderId } from '../providers.ts'
import { displayAmount } from './format.ts'
import { errorLocaleKey } from './locales.ts'
import type { DshBalanceLocaleKey, LOCALE_NS } from './locales.ts'

export interface BalanceTabInjected {
  loadBalance: (forceRefresh: boolean, signal: AbortSignal, provider?: BalanceProviderId) => Promise<BalanceApiResponse>
}

export type BalanceTabProps = BalanceTabInjected & PropsLocale<typeof LOCALE_NS> & { provider?: BalanceProviderId }

function BalanceCard({ info, t }: { info: BalanceInfo; t: BalanceTabProps['t'] }) {
  const details: [DshBalanceLocaleKey, string | undefined][] = [
    ['balance.toppedUp', info.toppedUpBalance],
    ['balance.granted', info.grantedBalance],
    ['balance.totalCash', info.totalCashBalance],
    ['balance.totalVoucher', info.totalVoucherBalance],
  ]
  return (
    <article className="dsh-balance-card">
      <div className="dsh-balance-card-head">
        <span>{t('balance.availableAmount')}</span><span className="dsh-balance-currency">{info.currency}</span>
      </div>
      <p className="dsh-balance-total">{displayAmount(info.totalBalance, info.currency, t('locale.tag'))}</p>
      <dl className="dsh-balance-breakdown">
        {details.filter(([, value]) => value !== undefined).map(([label, value]) => (
          <div key={label}><dt>{t(label)}</dt><dd>{displayAmount(value!, info.currency, t('locale.tag'))}</dd></div>
        ))}
      </dl>
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
          {result.code === 'MISSING_API_KEY' ? <p>{t(provider === 'tokener' ? 'balance.setupTokener' : provider === 'deepseek' ? 'balance.setupDeepSeek' : 'balance.setup', { provider: providerName, ref: findBalanceProvider(provider)!.apiKeyRef })}</p> : null}
        </div>
      ) : null}
      {result?.ok === true ? (
        <>
          <div className="dsh-balance-availability" data-available={String(result.isAvailable)}>
            <span className="dsh-balance-dot" aria-hidden="true" />
            <span>{result.accountType !== undefined ? t(`balance.${result.accountType}`) : t(result.isAvailable ? 'balance.available' : 'balance.unavailable')}</span>
          </div>
          {result.balanceInfos.length > 0
            ? <div className="dsh-balance-grid">{result.balanceInfos.map(info => <BalanceCard key={info.currency} info={info} t={t} />)}</div>
            : <p className="dsh-balance-status">{t('balance.empty')}</p>}
          {result.accountType !== undefined ? <p className="dsh-balance-copy">{t('balance.totalsNote')}</p> : null}
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
