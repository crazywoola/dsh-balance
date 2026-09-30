import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { LOCALE_NS } from './locales.ts'
import { Dropdown } from './Dropdown.tsx'

type Translator = PropsLocale<typeof LOCALE_NS>['t']
interface DetailTab<T extends string> { value: T; label: string; count: number }

export function DetailPanel<T extends string>({ label, tabs, value, onChange, toolbar, children }: {
  label: string
  tabs: readonly DetailTab<T>[]
  value: T
  onChange: (value: T) => void
  toolbar?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  return <section className="dsh-billing-detail-panel" aria-label={label}>
    <div className="dsh-billing-detail-header">
      <div className="dsh-billing-detail-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => <button key={tab.value} ref={element => { buttons.current[index] = element }}
          type="button" role="tab" id={`${id}-${tab.value}`} aria-controls={`${id}-panel`}
          aria-selected={value === tab.value} tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)} onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
              : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined
            if (next === undefined) return
            event.preventDefault()
            onChange(tabs[next]!.value)
            buttons.current[next]?.focus()
          }}>
          {tab.label}<span className="dsh-billing-tab-count">{tab.count}</span>
        </button>)}
      </div>
      <div className="dsh-billing-detail-mobile">
        <Dropdown label={label} value={value} onChange={onChange}
          options={tabs.map(tab => ({ value: tab.value, label: `${tab.label} · ${tab.count}` }))} />
      </div>
      {toolbar ? <div className="dsh-billing-detail-tools">{toolbar}</div> : null}
    </div>
    <div className="dsh-billing-detail-body" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${value}`} tabIndex={0}>
      {children}
    </div>
  </section>
}

export function PagedRows<T>({ items, render, t }: { items: readonly T[]; render: (items: readonly T[]) => ReactNode; t: Translator }) {
  const [page, setPage] = useState(0)
  const [size, setSize] = useState<'5' | '10' | '20'>('10')
  const pageSize = Number(size)
  const lastPage = Math.max(0, Math.ceil(items.length / pageSize) - 1)
  const currentPage = Math.min(page, lastPage)
  const start = currentPage * pageSize
  return <>
    {render(items.slice(start, start + pageSize))}
    {items.length > 0 ? <div className="dsh-billing-pagination" aria-label={t('billing.pagination')}>
      <span>{t('billing.pageRange', { from: start + 1, to: Math.min(start + pageSize, items.length), count: items.length })}</span>
      <div className="dsh-billing-pagination-actions">
        <Dropdown label={t('billing.pageSize')} value={size} onChange={value => { setSize(value); setPage(0) }}
          options={(['5', '10', '20'] as const).map(value => ({ value, label: t('billing.perPage', { count: value }) }))} />
        <button className="dsh-billing-page-button" type="button" disabled={currentPage === 0}
          aria-label={t('billing.previousPage')} onClick={() => setPage(currentPage - 1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 4-4 4 4 4" /></svg>
        </button>
        <button className="dsh-billing-page-button" type="button" disabled={currentPage === lastPage}
          aria-label={t('billing.nextPage')} onClick={() => setPage(currentPage + 1)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
        </button>
      </div>
    </div> : null}
  </>
}
