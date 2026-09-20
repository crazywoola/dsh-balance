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
        <div className="dsh-ledger-eyebrow"><span>DSH / {t('panel.ledger')}</span><span>{t('panel.private')}</span></div>
        <div className="dsh-ledger-intro">
          <div><h1>{t('panel.title')}</h1><p>{t('panel.copy')}</p></div>
          <div className="dsh-ledger-orbit" aria-hidden="true"><i /><i /><i /><span>↗</span></div>
        </div>
      </header>
      <div className="dsh-provider-switch" role="group" aria-label={t('panel.providers')}>
        {BALANCE_PROVIDERS.map((item, index) => (
          <button key={item.id} type="button" aria-pressed={provider === item.id} onClick={() => setProvider(item.id)}>
            <span className="dsh-provider-index">0{index + 1}</span>
            <span>{item.name}</span><span className="dsh-provider-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      <BalanceSection key={`balance-${provider}`} provider={provider} loadBalance={loadBalance} t={t} />
      <div className="dsh-ledger-section-label"><span>02 / {t('panel.models')}</span><span>{findBalanceProvider(provider)!.name}</span></div>
      <ModelsSection key={`models-${provider}`} provider={provider} loadModels={loadModels} t={t} />
      <div className="dsh-ledger-section-label"><span>03 / {t('panel.activity')}</span><span>{t('panel.allProviders')}</span></div>
      <BillingOverview loadUsage={loadUsage} t={t} />
    </div>
  )
}
