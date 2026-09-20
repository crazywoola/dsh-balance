import React from 'react'
import { createRoot } from 'react-dom/client'
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
const loadModels = async () => ({ ok: true, fetchedAt, source: 'live', models: [{ id: 'deepseek-v4-flash', ownedBy: 'deepseek' }, { id: 'deepseek-v4-pro', ownedBy: 'deepseek' }] })
const loadUsage = async () => ({ ok: true, scope: 'all', fetchedAt, source: 'live', ...aggregateBilling([], { timeZone: 'Asia/Shanghai' }) })
createRoot(document.getElementById('root')).render(<DeepSeekPanel t={t} loadBalance={loadBalance} loadModels={loadModels} loadUsage={loadUsage} />)
