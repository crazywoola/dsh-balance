import { useCallback, useEffect, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelInfo, ModelsApiResponse } from '../types.ts'
import { errorLocaleKey } from './locales.ts'
import type { LOCALE_NS } from './locales.ts'

export interface ModelsTabInjected {
  loadModels: (forceRefresh: boolean, signal: AbortSignal) => Promise<ModelsApiResponse>
}

export type ModelsTabProps = PropsRuntime<'settings.plugins.tab'> & InjectFace<ModelsTabInjected> & PropsLocale<typeof LOCALE_NS>

function ModelCard({ model, t }: { model: ModelInfo; t: ModelsTabProps['t'] }) {
  return (
    <article className="dsh-model-card">
      <code className="dsh-model-id">{model.id}</code>
      <span className="dsh-model-owner">{t('models.owner', { owner: model.ownedBy })}</span>
    </article>
  )
}

export function ModelsTab({ loadModels, t }: ModelsTabProps) {
  const [result, setResult] = useState<ModelsApiResponse>()
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (forceRefresh: boolean, signal: AbortSignal) => {
    setLoading(true)
    try {
      setResult(await loadModels(forceRefresh, signal))
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
  }, [loadModels])

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
    <section className="dsh-models-tab" aria-labelledby="dsh-models-title">
      <div className="dsh-balance-summary">
        <div>
          <h2 id="dsh-models-title" className="dsh-balance-heading">{t('models.title')}</h2>
          <p className="dsh-balance-copy">{t('models.copy')}</p>
        </div>
        <button className="dsh-balance-refresh" type="button" disabled={loading} onClick={refresh}>
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
