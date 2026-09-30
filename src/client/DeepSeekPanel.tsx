import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { BALANCE_PROVIDERS, findBalanceProvider } from '../providers.ts'
import type { BalanceProviderId } from '../providers.ts'
import { BalanceSection } from './BalanceTab.tsx'
import type { BalanceTabInjected } from './BalanceTab.tsx'
import type { LOCALE_NS } from './locales.ts'
import { ModelsSection } from './ModelsTab.tsx'
import type { ModelsTabInjected } from './ModelsTab.tsx'
import { BillingOverview } from './BillingTab.tsx'
import type { UsageTabInjected } from './BillingTab.tsx'

export interface DeepSeekPanelInjected extends BalanceTabInjected, ModelsTabInjected, UsageTabInjected {}

export type DeepSeekPanelProps = PropsRuntime<'settings.section'>
  & InjectFace<DeepSeekPanelInjected>
  & PropsLocale<typeof LOCALE_NS>

/** Provider-neutral settings workspace. The exported name preserves existing integrations. */
export function DeepSeekPanel({ loadBalance, loadModels, loadUsage, t }: DeepSeekPanelProps) {
  const [provider, setProvider] = useState<BalanceProviderId>('deepseek')
  return (
    <div className="dsh-deepseek-panel">
      <header className="dsh-ledger-header">
        <h1>{t('panel.title')}</h1><p className="dsh-balance-copy">{t('panel.copy')}</p>
      </header>
      <div className="dsh-provider-switch" role="group" aria-label={t('panel.providers')}>
        {BALANCE_PROVIDERS.map(item => (
          <button key={item.id} type="button" aria-pressed={provider === item.id} onClick={() => setProvider(item.id)}>{item.name}</button>
        ))}
      </div>
      <BalanceSection key={`balance-${provider}`} provider={provider} loadBalance={loadBalance} t={t} />
      <div className="dsh-ledger-section-label"><span>{t('panel.models')}</span><span>{findBalanceProvider(provider)!.name}</span></div>
      <ModelsSection key={`models-${provider}`} provider={provider} loadModels={loadModels} t={t} />
      <div className="dsh-ledger-section-label"><span>{t('panel.activity')}</span></div>
      <BillingOverview provider={provider} loadUsage={loadUsage} t={t} />
    </div>
  )
}
