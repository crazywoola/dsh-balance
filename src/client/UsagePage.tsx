import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { LOCALE_NS } from './locales.ts'
import { BillingOverview } from './BillingTab.tsx'
import type { UsageTabInjected } from './BillingTab.tsx'

export type UsagePageProps = PropsRuntime<'main'> & InjectFace<UsageTabInjected> & PropsLocale<typeof LOCALE_NS>

export function UsagePage({ loadUsage, t }: UsagePageProps) {
  return <div className="dsh-usage-page"><div className="dsh-usage-content">
    <BillingOverview loadUsage={loadUsage} t={t} />
  </div></div>
}

export function UsagePanelIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4v16h16M9 15V9m5 6V5m5 10v-4" />
  </svg>
}
