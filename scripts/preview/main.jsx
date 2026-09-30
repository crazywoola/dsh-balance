import React from 'react'
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { Dropdown } from '../../src/client/Dropdown.tsx'
import { BalanceDock } from '../../src/client/BalanceDock.tsx'
import { UsagePage } from '../../src/client/UsagePage.tsx'
import { BillingView } from '../../src/client/BillingTab.tsx'
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
  const sources = Array.from({ length: 3 }, (_, session) => {
    const events = []
    for (let day = 0; day < 30; day++) {
      for (const hour of [8, 10, 11, 14, 15, 17, 20, 22]) {
        const count = (day * 7 + hour * 3 + session * 5) % 5
        for (let call = 0; call < count; call++) {
          const at = new Date()
          at.setDate(at.getDate() - day)
          at.setHours(hour, call * 8, 0, 0)
          if (at > new Date()) continue
          const provider = session === 2 ? 'stepfun' : 'deepseek'
          const model = session === 2 ? 'step-3.5-flash' : session === 1 ? 'deepseek-v4-pro' : 'deepseek-v4-flash'
          const turn = events.length / 2 + 1
          events.push({ type: 'step/start', seq: events.length, time: +at, data: { turn, step: 0 } })
          events.push({ type: 'assistant/message', seq: events.length, time: +at + 1_000, data: { turn, step: 0,
            message: { source: { provider, model } }, usage: { inputTokens: 1000 + call * 200, outputTokens: 300, cacheReadTokens: 2000, cacheWriteTokens: 0 } } })
        }
      }
    }
    return { sessionId: `sample-${session}`, title: ['代码审查 / Code review', '日常任务 / Daily tasks', '模型评估 / Model evaluation'][session], inheritedEventCount: 0, events: state === 'empty' ? [] : events }
  })
  if (params.get('page') === 'session') {
    const total = { inputTokens: 452720, outputTokens: 54176, cacheReadTokens: 6654232, cacheWriteTokens: 0 }
    const events = Array.from({ length: 124 }, (_, index) => {
      const usage = Object.fromEntries(Object.entries(total).map(([key, tokens]) => [key, Math.floor(tokens / 124) + (index < tokens % 124 ? 1 : 0)]))
      const at = new Date('2026-09-29T02:22:19Z').getTime() + index * 10000
      return [{ type: 'step/start', seq: index * 2, time: at, data: { turn: Math.floor(index / 12) + 1, step: index % 12 } },
        { type: 'assistant/message', seq: index * 2 + 1, time: at + 1000, data: { turn: Math.floor(index / 12) + 1, step: index % 12,
          message: { source: { provider: 'StepFun', model: 'step-5-preview' } }, usage } }]
    }).flat()
    sources.splice(0, sources.length, { sessionId: 'preview', title: 'StepFun conversation', inheritedEventCount: 0, events: state === 'empty' ? [] : events })
  }
  const aggregate = aggregateBilling(sources, options)
  if (options.scope === 'session') return { ok: true, scope: 'session', fetchedAt, source: 'live', summary: aggregate.summary,
    session: aggregate.summary.bySession[0] ?? { ...aggregate.summary.totals, sessionId: 'preview', title: 'StepFun conversation' }, requests: aggregate.requestsBySession.get('preview') ?? [] }
  return { ok: true, scope: 'all', fetchedAt, source: 'live', summary: aggregate.summary }
}
const choices = [
  { provider: 'deepseek-official', model: 'deepseek-flash' },
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
function Preview() {
  const [choice, setChoice] = useState('0')
  return <>
    {['usage', 'session'].includes(params.get('page')) ? null : <div style={{ padding: '16px', marginBottom: '24px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '8px' }}>
      <Dropdown label="示例模型 / Sample model" value={choice} options={choices.map((item, index) => ({ value: String(index), label: `${item.provider} / ${item.model}` }))}
        onChange={value => { setChoice(value); snapshot = { ...snapshot, current: choices[Number(value)] }; listeners.forEach(listener => listener()) }} />
      <BalanceDock t={t} selection={selection} sessionId="preview" loadBalance={loadBalance} />
    </div>}
    {params.get('page') === 'session' ? <BillingView t={t} loadUsage={loadUsage} sessionId="preview" useSession={() => false} useProjection={() => ({})} />
      : params.get('page') === 'usage' ? <UsagePage t={t} loadUsage={loadUsage} /> : <DeepSeekPanel t={t} loadBalance={loadBalance} loadModels={loadModels} loadUsage={loadUsage} />}
  </>
}
createRoot(document.getElementById('root')).render(<Preview />)
