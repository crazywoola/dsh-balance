import { useCallback, useEffect, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceApiResponse, BalanceInfo } from '../types.ts'

export interface BalanceTabInjected {
  loadBalance: (forceRefresh: boolean, signal: AbortSignal) => Promise<BalanceApiResponse>
}

export type BalanceTabProps = PropsRuntime<'settings.plugins.tab'> & InjectFace<BalanceTabInjected>

function displayAmount(value: string, currency: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return `${value} ${currency}`
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(amount)
  } catch {
    return `${value} ${currency}`
  }
}

function BalanceCard({ info }: { info: BalanceInfo }) {
  return (
    <article className="dsh-balance-card">
      <div className="dsh-balance-card-head">
        <span className="dsh-balance-currency">{info.currency}</span>
      </div>
      <p className="dsh-balance-total">{displayAmount(info.totalBalance, info.currency)}</p>
      <dl className="dsh-balance-breakdown">
        <dt>充值余额</dt>
        <dd>{displayAmount(info.toppedUpBalance, info.currency)}</dd>
        <dt>赠送余额</dt>
        <dd>{displayAmount(info.grantedBalance, info.currency)}</dd>
      </dl>
    </article>
  )
}

export function BalanceTab({ loadBalance }: BalanceTabProps) {
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
        message: error instanceof Error ? error.message : '无法读取余额',
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
    <section className="dsh-balance-tab" aria-labelledby="dsh-balance-title">
      <div className="dsh-balance-summary">
        <div>
          <h2 id="dsh-balance-title" className="dsh-balance-heading">DeepSeek API 余额</h2>
          <p className="dsh-balance-copy">余额由本机 Host 使用已保存的 API 密钥查询，密钥不会发送到浏览器。</p>
        </div>
        <button className="dsh-balance-refresh" type="button" disabled={loading} onClick={refresh}>
          {loading ? '查询中…' : '刷新余额'}
        </button>
      </div>

      {loading && result === undefined ? <p className="dsh-balance-status" role="status">正在查询 DeepSeek 账户余额…</p> : null}
      {result?.ok === false ? <p className="dsh-balance-error" role="alert">{result.message}</p> : null}
      {result?.ok === true ? (
        <>
          <div className="dsh-balance-availability" data-available={String(result.isAvailable)}>
            <span className="dsh-balance-dot" aria-hidden="true" />
            <span>{result.isAvailable ? '当前账户有可用余额' : '当前账户没有可用余额'}</span>
          </div>
          {result.balanceInfos.length > 0
            ? <div className="dsh-balance-grid">{result.balanceInfos.map(info => <BalanceCard key={info.currency} info={info} />)}</div>
            : <p className="dsh-balance-status">DeepSeek 未返回任何币种余额。</p>}
          <p className="dsh-balance-meta">
            更新于 {new Date(result.fetchedAt).toLocaleString('zh-CN')}{result.source === 'cache' ? ' · 缓存' : ''}
          </p>
        </>
      ) : null}
    </section>
  )
}
