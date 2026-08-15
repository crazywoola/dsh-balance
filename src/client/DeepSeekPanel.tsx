import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { BalanceSection } from './BalanceTab.tsx'
import type { BalanceTabInjected } from './BalanceTab.tsx'
import type { LOCALE_NS } from './locales.ts'
import { ModelsSection } from './ModelsTab.tsx'
import type { ModelsTabInjected } from './ModelsTab.tsx'

export interface DeepSeekPanelInjected extends BalanceTabInjected, ModelsTabInjected {}

export type DeepSeekPanelProps = PropsRuntime<'settings.section'>
  & InjectFace<DeepSeekPanelInjected>
  & PropsLocale<typeof LOCALE_NS>

/** Standalone DeepSeek settings page, placed immediately after Agent presets. */
export function DeepSeekPanel({ loadBalance, loadModels, t }: DeepSeekPanelProps) {
  return (
    <div className="dsh-deepseek-panel">
      <BalanceSection loadBalance={loadBalance} t={t} />
      <div className="dsh-deepseek-divider" aria-hidden="true" />
      <ModelsSection loadModels={loadModels} t={t} />
    </div>
  )
}
