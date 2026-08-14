import { useCallback, useEffect, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelInfo, ModelsApiResponse } from '../types.ts'

export interface ModelsTabInjected {
  loadModels: (forceRefresh: boolean, signal: AbortSignal) => Promise<ModelsApiResponse>
}

export type ModelsTabProps = PropsRuntime<'settings.plugins.tab'> & InjectFace<ModelsTabInjected>

function ModelCard({ model }: { model: ModelInfo }) {
  return (
    <article className="dsh-model-card">
      <code className="dsh-model-id">{model.id}</code>
      <span className="dsh-model-owner">由 {model.ownedBy} 提供</span>
    </article>
  )
}

export function ModelsTab({ loadModels }: ModelsTabProps) {
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
        message: error instanceof Error ? error.message : '无法读取模型列表',
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
          <h2 id="dsh-models-title" className="dsh-balance-heading">DeepSeek 可用模型</h2>
          <p className="dsh-balance-copy">从 DeepSeek 官方 /models 接口读取当前 API Key 可访问的模型。</p>
        </div>
        <button className="dsh-balance-refresh" type="button" disabled={loading} onClick={refresh}>
          {loading ? '查询中…' : '刷新模型'}
        </button>
      </div>

      {loading && result === undefined ? <p className="dsh-balance-status" role="status">正在查询 DeepSeek 模型列表…</p> : null}
      {result?.ok === false ? <p className="dsh-balance-error" role="alert">{result.message}</p> : null}
      {result?.ok === true ? (
        <>
          <div className="dsh-model-count">
            <span className="dsh-balance-dot" aria-hidden="true" />
            <span>当前可用 {result.models.length} 个模型</span>
          </div>
          {result.models.length > 0
            ? <div className="dsh-model-grid">{result.models.map(model => <ModelCard key={model.id} model={model} />)}</div>
            : <p className="dsh-balance-status">DeepSeek 未返回任何可用模型。</p>}
          <p className="dsh-balance-meta">
            更新于 {new Date(result.fetchedAt).toLocaleString('zh-CN')}{result.source === 'cache' ? ' · 缓存' : ''}
          </p>
        </>
      ) : null}
    </section>
  )
}
