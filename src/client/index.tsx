import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BalanceApiResponse, ModelsApiResponse } from '../types.ts'
import { BALANCE_ROUTE, MODELS_ROUTE } from '../types.ts'
import { BalanceTab } from './BalanceTab.tsx'
import type { BalanceTabInjected } from './BalanceTab.tsx'
import { ModelsTab } from './ModelsTab.tsx'
import type { ModelsTabInjected } from './ModelsTab.tsx'
import { en, LOCALE_NS, zh } from './locales.ts'
import { balanceStyles } from './styles.ts'

export type { BalanceTabInjected, BalanceTabProps } from './BalanceTab.tsx'
export type { ModelsTabInjected, ModelsTabProps } from './ModelsTab.tsx'

export const inject = ['slots', 'locale']

async function loadBalance(forceRefresh: boolean, signal: AbortSignal): Promise<BalanceApiResponse> {
  const url = forceRefresh ? `${BALANCE_ROUTE}?refresh=1` : BALANCE_ROUTE
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const value: unknown = await response.json()
  if (typeof value !== 'object' || value === null || !('ok' in value) || typeof value.ok !== 'boolean') {
    throw new Error('余额插件收到了无法识别的 Host 响应')
  }
  return value as BalanceApiResponse
}

async function loadModels(forceRefresh: boolean, signal: AbortSignal): Promise<ModelsApiResponse> {
  const url = forceRefresh ? `${MODELS_ROUTE}?refresh=1` : MODELS_ROUTE
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  const value: unknown = await response.json()
  if (typeof value !== 'object' || value === null || !('ok' in value) || typeof value.ok !== 'boolean') {
    throw new Error('模型插件收到了无法识别的 Host 响应')
  }
  return value as ModelsApiResponse
}

/** Register one feature-owned page inside the existing Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(LOCALE_NS, { zh, en }),
    'dsh-balance: dictionaries',
  )
  const t = ctx.locale.bind(LOCALE_NS)

  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-balance'
    style.dataset.pluginCss = 'dsh-balance/styles'
    style.textContent = balanceStyles
    document.head.append(style)
    return () => { style.remove() }
  }, 'dsh-balance: styles')

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'deepseek-balance',
    order: 20,
    label: () => t('tab.balance'),
    locale: LOCALE_NS,
    inject: (): BalanceTabInjected => ({ loadBalance }),
  }, BalanceTab))
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'deepseek-models',
    order: 21,
    label: () => t('tab.models'),
    locale: LOCALE_NS,
    inject: (): ModelsTabInjected => ({ loadModels }),
  }, ModelsTab))
}
