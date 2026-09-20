import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { findBalanceProvider } from '../providers.ts'
import type { BalanceProviderId } from '../providers.ts'
import type { BalanceApiResponse } from '../types.ts'
import { displayAmount, formatClockTime } from './format.ts'
import type { LOCALE_NS } from './locales.ts'
import { isPeakHour, nextPeriodChange, PEAK_EFFECTIVE_FROM } from './pricing.ts'

const REFRESH_INTERVAL_MS = 60_000
const PEAK_TICK_MS = 30_000

export interface BalanceDockInjected {
  selection: {
    store: Pick<SnapshotStore<Pick<ModelDirectoryState, 'current' | 'status'>>, 'subscribe' | 'getSnapshot'>
    load: () => Promise<unknown>
  }
  loadBalance: (forceRefresh: boolean, signal: AbortSignal, provider: BalanceProviderId) => Promise<BalanceApiResponse>
}

export type BalanceDockProps = PropsRuntime<'conversation.composer.dock'>
  & InjectFace<BalanceDockInjected>
  & PropsLocale<typeof LOCALE_NS>

/** Compact ambient balance readout below the active-session composer card. */
export function BalanceDock({ selection, loadBalance, t, sessionId }: BalanceDockProps) {
  const snapshot = useSyncExternalStore(selection.store.subscribe, selection.store.getSnapshot)
  useEffect(() => {
    if (selection.store.getSnapshot().status === 'idle') void selection.load().catch(() => {})
  }, [selection])
  const current = snapshot.current
  const provider = current === null ? undefined : findBalanceProvider(current.provider)
  return <ProviderBalanceDock key={`${sessionId}:${current?.provider ?? ''}`} provider={provider?.id}
    providerName={provider?.name ?? current?.provider} model={current?.model} loadBalance={loadBalance} t={t} />
}

function ProviderBalanceDock({ provider, providerName, model, loadBalance, t }: {
  provider: BalanceProviderId | undefined
  providerName: string | undefined
  model: string | undefined
  loadBalance: BalanceDockInjected['loadBalance']
  t: BalanceDockProps['t']
}) {
  const [result, setResult] = useState<BalanceApiResponse>()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), PEAK_TICK_MS)
    return () => { window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (provider === undefined) return
    let controller: AbortController | undefined

    const load = () => {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      void loadBalance(false, signal, provider).then((value) => {
        if (!signal.aborted) setResult(value)
      }).catch(() => {
        if (!signal.aborted) {
          setResult({ ok: false, code: 'UPSTREAM_UNAVAILABLE', message: '' })
        }
      })
    }

    load()
    const timer = window.setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
      controller?.abort()
    }
  }, [loadBalance, provider])

  const summary = useMemo(() => {
    if (providerName === undefined) return t('dock.noSelection')
    if (provider === undefined) return t('error.UNSUPPORTED_PROVIDER')
    if (result === undefined) return t('dock.loading')
    if (!result.ok) return t('dock.unavailable')
    if (result.balanceInfos.length === 0) return t('dock.empty')
    return result.balanceInfos
      .map(info => `${info.currency} ${displayAmount(info.totalBalance, info.currency, t('locale.tag'))}`)
      .join(' · ')
  }, [result, t, provider, providerName])

  const state = provider === undefined ? 'unknown'
    : result === undefined ? 'loading'
      : !result.ok ? 'error'
        : result.isAvailable === null ? 'unknown'
          : result.isAvailable ? 'available' : 'empty'
  const accessibleState = result?.ok === true && result.isAvailable !== null
    ? t(result.isAvailable ? 'balance.available' : 'balance.unavailable') : undefined
  const label = providerName === undefined ? t('nav.balance') : t('dock.label', { provider: providerName })

  const pricingActive = provider === 'deepseek' && now.getTime() >= PEAK_EFFECTIVE_FROM
  const isPeak = pricingActive && isPeakHour(now)
  const periodLabel = pricingActive ? t(isPeak ? 'pricing.peak' : 'pricing.offPeak') : undefined
  const periodTitle = pricingActive
    ? t(isPeak ? 'pricing.peakHint' : 'pricing.offPeakHint', {
        time: formatClockTime(nextPeriodChange(now), t('locale.tag')),
      })
    : undefined

  return (
    <div
      className="dsh-balance-dock"
      role="status"
      aria-live="polite"
      title={periodTitle}
      aria-label={`${label}${model === undefined ? '' : ` / ${model}`}: ${summary}${accessibleState === undefined ? '' : `. ${accessibleState}`}${periodLabel === undefined ? '' : `. ${periodLabel}`}`}
    >
      <span className="dsh-balance-dock-dot" data-state={state} data-peak={isPeak ? 'true' : undefined} aria-hidden="true" />
      <span>{label}</span>
      {model === undefined ? null : <code className="dsh-balance-dock-model" title={model}>{model}</code>}
      <span className="dsh-balance-dock-separator" aria-hidden="true">|</span>
      <span className="dsh-balance-dock-value">{summary}</span>
    </div>
  )
}
