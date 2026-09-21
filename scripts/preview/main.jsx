import React from 'react'
import { createRoot } from 'react-dom/client'
import { BalanceDock } from '../../src/client/BalanceDock.tsx'
import { DeepSeekPanel } from '../../src/client/DeepSeekPanel.tsx'
import { balanceStyles } from '../../src/client/styles.ts'
import { en, zh } from '../../src/client/locales.ts'
import { aggregateBilling } from '../../src/billing.ts'

const params = new URLSearchParams(location.search)
const locale = params.get('lang') === 'en' ? en : zh
const state = params.get('state')
document.documentElement.lang = locale['locale.tag']
document.documentElement.dataset.theme = params.get('theme') ?? 'light'
const t = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), locale[key] ?? key)
const style = document.createElement('style')
style.textContent = balanceStyles
document.head.append(style)
const fetchedAt = new Date().toISOString()
const loadBalance = async (refresh, signal, provider = 'deepseek') => {
  await new Promise(resolve => setTimeout(resolve, state === 'loading' ? 60_000 : 300))
  signal.throwIfAborted()
  if (state === 'missing') return { ok: false, code: 'MISSING_API_KEY', message: '' }
  if (state === 'error') return { ok: false, code: 'UPSTREAM_TIMEOUT', message: '' }
  return {
    ok: true, provider, fetchedAt, source: refresh ? 'live' : 'cache',
    isAvailable: provider === 'stepfun' ? null : true,
    ...(provider === 'stepfun' ? { accountType: params.get('account') === 'postpaid' ? 'postpaid' : 'prepaid' } : {}),
    balanceInfos: state === 'empty' ? [] : provider === 'stepfun'
      ? [{ currency: 'CNY', totalBalance: params.get('amount') ?? '256.80', totalCashBalance: '500', totalVoucherBalance: '26' }]
      : [{ currency: 'CNY', totalBalance: '128.50', toppedUpBalance: '120', grantedBalance: '8.50' }, { currency: 'USD', totalBalance: '18.25', toppedUpBalance: '17', grantedBalance: '1.25' }],
  }
}
const loadModels = async (refresh, signal, provider = 'deepseek') => {
  await new Promise(resolve => setTimeout(resolve, provider === 'stepfun' ? 500 : 200))
  signal.throwIfAborted()
  return { ok: true, provider, fetchedAt, source: refresh ? 'live' : 'cache', models: provider === 'stepfun'
    ? [{ id: 'step-3.5-flash', ownedBy: 'stepai', created: 1713974400 }, { id: 'step-3.7-flash', ownedBy: 'stepai', created: 1713196800 }]
    : [{ id: 'deepseek-v4-flash', ownedBy: 'deepseek' }, { id: 'deepseek-v4-pro', ownedBy: 'deepseek' }] }
}
const loadUsage = async (options) => {
  const events = ['deepseek', 'stepfun'].flatMap((provider, index) => [
    { type: 'step/start', seq: index * 2, time: Date.now(), data: { turn: index + 1, step: 0 } },
    { type: 'assistant/message', seq: index * 2 + 1, time: Date.now(), data: { turn: index + 1, step: 0,
      message: { source: { provider, model: provider === 'deepseek' ? 'deepseek-v4-flash' : 'step-3.5-flash' } },
      usage: { inputTokens: 10000, outputTokens: 5000, cacheReadTokens: 2000, cacheWriteTokens: 1000 } } },
  ])
  return { ok: true, scope: 'all', fetchedAt, source: 'live', ...aggregateBilling([{ sessionId: 'sample', title: '示例会话 / Sample', header: {}, events }], options) }
}
const choices = [
  { provider: 'deepseek', model: 'deepseek-v4-flash' },
  { provider: 'StepFun', model: 'step-3.5-flash' },
  { provider: 'StepFun', model: 'step-3.7-flash' },
  { provider: 'Other', model: 'custom-model' },
]
let snapshot = { current: choices[0], status: 'ready' }
const listeners = new Set()
const selection = {
  store: { getSnapshot: () => snapshot, subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) } },
  load: async () => {},
}
createRoot(document.getElementById('root')).render(<>
  <div style={{ padding: '16px', marginBottom: '24px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px' }}>
    <label>示例模型 / Sample model <select aria-label="Sample model" onChange={event => { snapshot = { ...snapshot, current: choices[Number(event.target.value)] }; listeners.forEach(listener => listener()) }}>
      {choices.map((choice, index) => <option key={index} value={index}>{choice.provider} / {choice.model}</option>)}
    </select></label>
    <BalanceDock t={t} selection={selection} sessionId="preview" loadBalance={loadBalance} />
  </div>
  <DeepSeekPanel t={t} loadBalance={loadBalance} loadModels={loadModels} loadUsage={loadUsage} />
</>)
