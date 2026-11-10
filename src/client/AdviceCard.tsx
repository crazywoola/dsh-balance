import { useEffect, useState } from 'react'
import type { AdviceApiResponse, AdviceEstimate, AdviceSuccess } from '../advice.ts'
import { displayAmount, displayTokens, formatClockTime } from './format.ts'
import type { DshBalanceLocaleKey, LOCALE_NS } from './locales.ts'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'

export interface AdviceLoadOptions {
  sessionId: string
  provider?: string
  model?: string
}

export interface AdviceCardProps {
  sessionId: string
  provider?: string
  model?: string
  loadAdvice: (options: AdviceLoadOptions, signal: AbortSignal) => Promise<AdviceApiResponse>
  t: PropsLocale<typeof LOCALE_NS>['t']
  usdToCny?: number | null
  compact?: boolean
}

function combined(estimate: Pick<AdviceEstimate, 'costUsd' | 'costCny' | 'combinedCny'>, rate: number | null | undefined): number | null {
  if (estimate.combinedCny !== null) return estimate.combinedCny
  if (rate === null || rate === undefined) return null
  return (estimate.costCny ?? 0) + (estimate.costUsd ?? 0) * rate
}

function formatCost(estimate: Pick<AdviceEstimate, 'costUsd' | 'costCny' | 'combinedCny'>, locale: string, rate: number | null | undefined, t: AdviceCardProps['t']): string {
  const parts: string[] = []
  if (estimate.costUsd !== null) parts.push(displayAmount(String(estimate.costUsd), 'USD', locale))
  if (estimate.costCny !== undefined) parts.push(displayAmount(String(estimate.costCny), 'CNY', locale))
  const converted = combined(estimate, rate)
  if (converted !== null && estimate.costUsd !== null) parts.push(`${displayAmount(String(converted), 'CNY', locale)} (${t('billing.fixedRate')})`)
  return parts.length === 0 ? t('advice.noEstimate') : parts.join(' · ')
}

/** Session-shaped next-turn estimates. Prompt text is never requested or rendered. */
export function AdviceCard({ sessionId, provider, model, loadAdvice, t, usdToCny = null, compact = false }: AdviceCardProps) {
  const [result, setResult] = useState<AdviceApiResponse>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void loadAdvice({
      sessionId,
      ...(provider === undefined ? {} : { provider }),
      ...(model === undefined ? {} : { model }),
    }, controller.signal).then((value) => {
      if (!controller.signal.aborted) setResult(value)
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ ok: false, code: 'UPSTREAM_UNAVAILABLE', message: '' })
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => { controller.abort() }
  }, [loadAdvice, sessionId, provider, model])

  const locale = t('locale.tag')
  if (loading && result === undefined) {
    return <p className={compact ? 'dsh-advice-dock' : 'dsh-balance-status'} role="status">{t('advice.loading')}</p>
  }
  if (result === undefined || !result.ok) {
    return <p className={compact ? 'dsh-advice-dock' : 'dsh-balance-status'} role="status">{t('advice.unavailable')}</p>
  }

  return compact
    ? <CompactAdvice advice={result} t={t} usdToCny={usdToCny} locale={locale} />
    : <PanelAdvice advice={result} t={t} usdToCny={usdToCny} locale={locale} />
}

function CompactAdvice({ advice, t, usdToCny, locale }: { advice: AdviceSuccess; t: AdviceCardProps['t']; usdToCny: number | null; locale: string }) {
  const now = advice.now === undefined ? t('advice.noEstimate') : formatCost(advice.now, locale, usdToCny, t)
  const after = advice.afterChange === undefined ? undefined : formatCost(advice.afterChange, locale, usdToCny, t)
  const fresh = advice.fresh === undefined ? undefined : formatCost(advice.fresh, locale, usdToCny, t)
  return (
    <div className="dsh-advice-dock">
      <span>{t('advice.now')}: {now}</span>
      {after === undefined ? null : <span> · {t('advice.afterChange')}: {after}</span>}
      {fresh === undefined ? null : <span> · {t('advice.fresh')}: {fresh}</span>}
      <div className="dsh-advice-note">{t('advice.estimateOnly')}</div>
    </div>
  )
}

function EstimateRow({ label, estimate, t, usdToCny, locale }: {
  label: string
  estimate: AdviceEstimate
  t: AdviceCardProps['t']
  usdToCny: number | null
  locale: string
}) {
  return (
    <div className="dsh-advice-row">
      <span>{label}</span>
      <strong>{formatCost(estimate, locale, usdToCny, t)}</strong>
      <small>{estimate.provider} / {estimate.model} · {t(`advice.period.${estimate.period}` as DshBalanceLocaleKey)}</small>
    </div>
  )
}

function PanelAdvice({ advice, t, usdToCny, locale }: { advice: AdviceSuccess; t: AdviceCardProps['t']; usdToCny: number | null; locale: string }) {
  const nextChange = advice.nextChangeAt === null ? undefined : formatClockTime(new Date(advice.nextChangeAt), locale)
  return (
    <section className="dsh-advice-card" aria-labelledby="dsh-advice-title">
      <div className="dsh-advice-card-head">
        <h3 id="dsh-advice-title" className="dsh-balance-heading">{t('advice.title')}</h3>
        <p className="dsh-balance-copy">{t('advice.copy')}</p>
      </div>
      <p className="dsh-advice-meta">
        {t(`advice.period.${advice.currentPeriod}` as DshBalanceLocaleKey)}
        {nextChange === undefined ? '' : ` · ${t('advice.nextChange', { time: nextChange })}`}
        {` · ${t('advice.sample', { count: advice.sampleSize, limit: advice.sampleLimit })}`}
      </p>
      {advice.tokenShape === null ? null : (
        <p className="dsh-advice-meta">{t('advice.shape', {
          input: displayTokens(advice.tokenShape.inputTokens, locale),
          output: displayTokens(advice.tokenShape.outputTokens, locale),
          cacheHit: displayTokens(advice.tokenShape.cacheReadTokens, locale),
          cacheWrite: displayTokens(advice.tokenShape.cacheWriteTokens, locale),
        })}</p>
      )}
      {advice.now === undefined ? <p className="dsh-advice-meta">{t('advice.noEstimate')}</p> : <EstimateRow label={t('advice.now')} estimate={advice.now} t={t} usdToCny={usdToCny} locale={locale} />}
      {advice.afterChange === undefined ? null : <EstimateRow label={t('advice.afterChange')} estimate={advice.afterChange} t={t} usdToCny={usdToCny} locale={locale} />}
      {advice.fresh === undefined ? null : <EstimateRow label={t('advice.fresh')} estimate={advice.fresh} t={t} usdToCny={usdToCny} locale={locale} />}
      {advice.cacheSavings === undefined ? null : (
        <div className="dsh-advice-row">
          <span>{t('advice.cacheSavings')}</span>
          <strong>{formatCost({ costUsd: advice.cacheSavings.costUsd, combinedCny: advice.cacheSavings.combinedCny, ...(advice.cacheSavings.costCny === undefined ? {} : { costCny: advice.cacheSavings.costCny }) }, locale, usdToCny, t)}</strong>
        </div>
      )}
      {advice.alternatives.length > 0 ? (
        <div className="dsh-advice-alternatives">
          {advice.alternatives.map(item => (
            <EstimateRow key={`${item.provider}:${item.model}:${item.pricingVersion}`} label={t('advice.alternative')} estimate={item} t={t} usdToCny={usdToCny} locale={locale} />
          ))}
        </div>
      ) : null}
      <p className="dsh-advice-meta">{t(`advice.coverage.${advice.coverage.status}` as DshBalanceLocaleKey, {
        priced: advice.coverage.pricedRequests,
        unpriced: advice.coverage.unpricedRequests,
        requests: advice.coverage.requests,
      })}</p>
      {advice.coverage.catalog.length > 0 ? (
        <p className="dsh-advice-meta">{t('advice.catalog', { versions: advice.coverage.catalog.map(item => `${item.provider} ${item.pricingVersion}`).join(' · ') })}</p>
      ) : null}
      <ul className="dsh-advice-caveats">
        {advice.caveats.map(key => <li key={key}>{t(`advice.caveat.${key}` as DshBalanceLocaleKey)}</li>)}
      </ul>
    </section>
  )
}
