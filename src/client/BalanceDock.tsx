import { useEffect, useMemo, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceApiResponse } from '../types.ts'
import { displayAmount } from './format.ts'
import type { LOCALE_NS } from './locales.ts'

const REFRESH_INTERVAL_MS = 60_000

export interface BalanceDockInjected {
  loadBalance: (forceRefresh: boolean, signal: AbortSignal) => Promise<BalanceApiResponse>
}

export type BalanceDockProps = PropsRuntime<'conversation.composer.dock'>
  & InjectFace<BalanceDockInjected>
  & PropsLocale<typeof LOCALE_NS>

/** Compact ambient balance readout below the active-session composer card. */
export function BalanceDock({ loadBalance, t }: BalanceDockProps) {
  const [result, setResult] = useState<BalanceApiResponse>()

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

  return (
    <div
      className="dsh-balance-dock"
      role="status"
      aria-live="polite"
      aria-label={`${t('dock.label')}: ${summary}${accessibleState === undefined ? '' : `. ${accessibleState}`}`}
    >
      <span className="dsh-balance-dock-dot" data-state={state} aria-hidden="true" />
      <span>{t('dock.label')}</span>
      <span className="dsh-balance-dock-separator" aria-hidden="true">|</span>
      <span className="dsh-balance-dock-value">{summary}</span>
    </div>
  )
}
