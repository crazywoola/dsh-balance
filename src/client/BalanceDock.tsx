import { useEffect, useMemo, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceApiResponse } from '../types.ts'
import { displayAmount, formatClockTime } from './format.ts'
import type { LOCALE_NS } from './locales.ts'
import { isPeakHour, nextPeriodChange, PEAK_EFFECTIVE_FROM } from './pricing.ts'

const REFRESH_INTERVAL_MS = 60_000
const PEAK_TICK_MS = 30_000

export interface BalanceDockInjected {
  loadBalance: (forceRefresh: boolean, signal: AbortSignal) => Promise<BalanceApiResponse>
}

export type BalanceDockProps = PropsRuntime<'conversation.composer.dock'>
  & InjectFace<BalanceDockInjected>
  & PropsLocale<typeof LOCALE_NS>

/** Compact ambient balance readout below the active-session composer card. */
export function BalanceDock({ loadBalance, t }: BalanceDockProps) {
  const [result, setResult] = useState<BalanceApiResponse>()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), PEAK_TICK_MS)
    return () => { window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    let controller: AbortController | undefined

    const load = () => {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      void loadBalance(false, signal).then((value) => {
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
  }, [loadBalance])

  const summary = useMemo(() => {
    if (result === undefined) return t('dock.loading')
    if (!result.ok) return t('dock.unavailable')
    if (result.balanceInfos.length === 0) return t('dock.empty')
    return result.balanceInfos
      .map(info => `${info.currency} ${displayAmount(info.totalBalance, info.currency, t('locale.tag'))}`)
      .join(' · ')
  }, [result, t])

  const state = result === undefined
    ? 'loading'
    : result.ok && result.isAvailable
      ? 'available'
      : result.ok
        ? 'empty'
        : 'error'

  const accessibleState = result?.ok === true
    ? t(result.isAvailable ? 'balance.available' : 'balance.unavailable')
    : undefined

  const pricingActive = now.getTime() >= PEAK_EFFECTIVE_FROM
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
      aria-label={`${t('dock.label')}: ${summary}${accessibleState === undefined ? '' : `. ${accessibleState}`}${periodLabel === undefined ? '' : `. ${periodLabel}`}`}
    >
      <span className="dsh-balance-dock-dot" data-state={state} data-peak={isPeak ? 'true' : undefined} aria-hidden="true" />
      <span>{t('dock.label')}</span>
      <span className="dsh-balance-dock-separator" aria-hidden="true">|</span>
      <span className="dsh-balance-dock-value">{summary}</span>
    </div>
  )
}
