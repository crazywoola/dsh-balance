import { useId, useMemo, useRef, useState } from 'react'
import type { UsageSummary } from '../billing.ts'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { LOCALE_NS } from './locales.ts'

export type PunchcardProps = PropsLocale<typeof LOCALE_NS> & { summary: UsageSummary }

export function Punchcard({ summary, t }: PunchcardProps) {
  const titleId = useId()
  const svg = useRef<SVGSVGElement>(null)
  const [active, setActive] = useState<number>()
  const [focus, setFocus] = useState(0)
  const cells = useMemo(() => {
    const buckets = new Map((summary.byWeekdayHour ?? []).map(bucket => [`${bucket.weekday}:${bucket.hour}`, bucket]))
    return Array.from({ length: 168 }, (_, index) => ({ weekday: Math.floor(index / 24), hour: index % 24, totals: buckets.get(`${Math.floor(index / 24)}:${index % 24}`) }))
  }, [summary.byWeekdayHour])
  const max = Math.max(0, ...cells.map(cell => cell.totals?.requests ?? 0))
  const weekdays = Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(t('locale.tag'), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 8, 27 + day))))
  const details = (index: number) => {
    const cell = cells[index]!
    const row = cell.totals
    const tokens = (row?.inputTokens ?? 0) + (row?.outputTokens ?? 0) + (row?.cacheReadTokens ?? 0) + (row?.cacheWriteTokens ?? 0)
    return t('punchcard.detail', { day: weekdays[cell.weekday]!, hour: String(cell.hour).padStart(2, '0'), count: row?.requests ?? 0, tokens: new Intl.NumberFormat(t('locale.tag')).format(tokens) })
  }
  const navigate = (index: number, key: string) => {
    const row = Math.floor(index / 24)
    const col = index % 24
    const next = key === 'ArrowRight' ? row * 24 + (col + 1) % 24 : key === 'ArrowLeft' ? row * 24 + (col + 23) % 24
      : key === 'ArrowDown' ? ((row + 1) % 7) * 24 + col : key === 'ArrowUp' ? ((row + 6) % 7) * 24 + col
        : key === 'Home' ? row * 24 : key === 'End' ? row * 24 + 23 : undefined
    if (next !== undefined) svg.current?.querySelector<SVGCircleElement>(`[data-cell="${next}"]`)?.focus()
    return next !== undefined
  }

  return <section className="dsh-punchcard" aria-labelledby={titleId}>
    <div className="dsh-punchcard-header">
      <div><h3 id={titleId}>{t('punchcard.title')}</h3><p>{t('punchcard.copy', { timeZone: summary.timeZone })}</p></div>
      <div className="dsh-punchcard-legend" aria-hidden="true"><span>{t('punchcard.less')}</span><i /><i /><i /><span>{t('punchcard.more')}</span></div>
    </div>
    <div className="dsh-punchcard-scroll">
      <svg ref={svg} viewBox="0 0 860 300" className="dsh-punchcard-chart" role="group" aria-label={t('punchcard.keyboard')}>
        {weekdays.map((day, index) => <g key={index}>
          <text x="0" y={48 + index * 34} className="dsh-punchcard-label">{day}</text>
          <line x1="68" x2="842" y1={44 + index * 34} y2={44 + index * 34} className="dsh-punchcard-line" />
        </g>)}
        {Array.from({ length: 24 }, (_, hour) => <text key={hour} x={82 + hour * 32} y="282" textAnchor="middle" className="dsh-punchcard-label">{String(hour).padStart(2, '0')}</text>)}
        {cells.map((cell, index) => {
          const count = cell.totals?.requests ?? 0
          return <circle key={index} data-cell={index} cx={82 + cell.hour * 32} cy={44 + cell.weekday * 34}
            r={count === 0 ? 1.5 : Math.max(2, 12 * Math.sqrt(count / max))} className="dsh-punchcard-dot"
            data-empty={count === 0} data-active={active === index} tabIndex={focus === index ? 0 : -1} role="img" aria-label={details(index)}
            onPointerEnter={() => setActive(index)} onPointerLeave={() => setActive(undefined)}
            onFocus={() => { setFocus(index); setActive(index) }} onBlur={() => setActive(undefined)}
            onKeyDown={event => { if (navigate(index, event.key)) event.preventDefault() }}><title>{details(index)}</title></circle>
        })}
      </svg>
    </div>
    <div className="dsh-punchcard-footer"><span>{t('punchcard.total', { count: summary.totals.requests })}</span><span role="status">{active === undefined ? t('punchcard.hint') : details(active)}</span></div>
  </section>
}
