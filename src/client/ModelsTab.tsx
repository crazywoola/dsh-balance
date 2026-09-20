import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelInfo, ModelsApiResponse } from '../types.ts'
import { findBalanceProvider } from '../providers.ts'
import type { BalanceProviderId } from '../providers.ts'
import { errorLocaleKey } from './locales.ts'
import type { LOCALE_NS } from './locales.ts'

export interface ModelsTabInjected {
  loadModels: (forceRefresh: boolean, signal: AbortSignal, provider?: BalanceProviderId) => Promise<ModelsApiResponse>
}

export type ModelsTabProps = ModelsTabInjected & PropsLocale<typeof LOCALE_NS> & { provider?: BalanceProviderId }

function ModelCard({ model, t }: { model: ModelInfo; t: ModelsTabProps['t'] }) {
  return (
    <article className="dsh-model-card">
      <code className="dsh-model-id">{model.id}</code>
      <span className="dsh-model-owner">{t('models.owner', { owner: model.ownedBy })}</span>
      {model.created === undefined ? null : <span className="dsh-model-owner">{t('models.created', { date: new Date(model.created * 1000).toLocaleDateString(t('locale.tag')) })}</span>}
    </article>
  )
}

export function ModelsSection({ loadModels, t, provider = 'deepseek' }: ModelsTabProps) {
  const [result, setResult] = useState<ModelsApiResponse>()
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
      const value = await loadModels(forceRefresh, signal, provider)
      if (!signal.aborted) setResult(value)
    } catch {
      if (!signal.aborted) setResult({ ok: false, code: 'UPSTREAM_UNAVAILABLE', message: '' })
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [loadModels, provider])

  useEffect(() => {
    setResult(undefined)
    void load(false)
    return () => { active.current?.abort() }
  }, [load])

  return (
    <section className="dsh-models-section" aria-labelledby="dsh-models-title" aria-busy={loading}>
      <div className="dsh-balance-summary">
        <div>
          <h2 id="dsh-models-title" className="dsh-balance-heading">{t('models.title', { provider: providerName })}</h2>
          <p className="dsh-balance-copy">{t('models.copy', { provider: providerName })}</p>
        </div>
        <button className="dsh-balance-refresh" type="button" disabled={loading} onClick={() => { void load(true) }}>
          {loading ? t('action.loading') : t('models.refresh')}
        </button>
      </div>

      {loading && result === undefined ? <p className="dsh-balance-status" role="status">{t('models.loading')}</p> : null}
      {result?.ok === false ? <p className="dsh-balance-error" role="alert">{t(errorLocaleKey(result.code))}</p> : null}
      {result?.ok === true ? (
        <>
          <div className="dsh-model-count">
            <span className="dsh-balance-dot" aria-hidden="true" />
            <span>{t('models.count', { count: result.models.length })}</span>
          </div>
          {result.models.length > 0
            ? <div className="dsh-model-grid">{result.models.map(model => <ModelCard key={model.id} model={model} t={t} />)}</div>
            : <p className="dsh-balance-status">{t('models.empty')}</p>}
          <p className="dsh-balance-meta">
            {t('meta.updated', { time: new Date(result.fetchedAt).toLocaleString(t('locale.tag')) })}{result.source === 'cache' ? t('meta.cached') : ''}
          </p>
        </>
      ) : null}
    </section>
  )
}

/** @deprecated The model view is now part of the provider settings panel. */
export const ModelsTab = ModelsSection
