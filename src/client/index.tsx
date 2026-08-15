import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BalanceApiResponse, ModelsApiResponse } from '../types.ts'
import { BALANCE_ROUTE, MODELS_ROUTE } from '../types.ts'
import { BalanceDock } from './BalanceDock.tsx'
import type { BalanceDockInjected } from './BalanceDock.tsx'
import { DeepSeekPanel } from './DeepSeekPanel.tsx'
import type { DeepSeekPanelInjected } from './DeepSeekPanel.tsx'
import { en, LOCALE_NS, zh } from './locales.ts'
import { balanceStyles } from './styles.ts'

export type { BalanceTabInjected, BalanceTabProps } from './BalanceTab.tsx'
export type { BalanceDockInjected, BalanceDockProps } from './BalanceDock.tsx'
export type { DeepSeekPanelInjected, DeepSeekPanelProps } from './DeepSeekPanel.tsx'
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

/** Register a standalone Settings page and an ambient composer balance readout. */
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

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'deepseek-balance',
    order: 21,
    label: () => t('nav.balance'),
    locale: LOCALE_NS,
    inject: (): DeepSeekPanelInjected => ({ loadBalance, loadModels }),
  }, DeepSeekPanel))

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'deepseek-balance',
    order: 10,
    locale: LOCALE_NS,
    inject: (): BalanceDockInjected => ({ loadBalance }),
  }, BalanceDock))
}
