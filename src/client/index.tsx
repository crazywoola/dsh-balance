import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BalanceApiResponse } from '../types.ts'
import { BALANCE_ROUTE } from '../types.ts'
import { BalanceTab } from './BalanceTab.tsx'
import type { BalanceTabInjected } from './BalanceTab.tsx'
import { balanceStyles } from './styles.ts'

export type { BalanceTabInjected, BalanceTabProps } from './BalanceTab.tsx'

export const inject = ['slots']

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

/** Register one feature-owned page inside the existing Plugins settings section. */
export function apply(ctx: ClientContext): void {
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
    label: 'DeepSeek 余额',
    inject: (): BalanceTabInjected => ({ loadBalance }),
  }, BalanceTab))
}
