import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface DropdownOption<T extends string> { value: T; label: string }
export interface DropdownProps<T extends string> {
  label: string
  value: T
  options: readonly DropdownOption<T>[]
  onChange: (value: T) => void
}

/** Theme-aware listbox: keep keyboard focus on its trigger and portal past scroll boundaries. */
export function Dropdown<T extends string>({ label, value, options, onChange }: DropdownProps<T>) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 200, maxHeight: 320 })
  const search = useRef({ text: '', time: 0 })
  const selected = options.findIndex(option => option.value === value)
  const show = () => { setActive(Math.max(selected, 0)); setOpen(true) }
  const choose = (index: number) => {
    const option = options[index]
    if (option === undefined) return
    onChange(option.value)
    setOpen(false)
    trigger.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || trigger.current === null) return
    const rect = trigger.current.getBoundingClientRect()
    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 24)
    const below = window.innerHeight - rect.bottom - 16
    const above = rect.top - 16
    const upwards = below < 160 && above > below
    const maxHeight = Math.max(80, Math.min(320, upwards ? above : below))
    const height = Math.min(list.current?.scrollHeight ?? options.length * 36 + 12, maxHeight)
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: upwards ? rect.top - height - 6 : rect.bottom + 6, width, maxHeight })
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      const node = event.target as Node
      if (!trigger.current?.contains(node) && !list.current?.contains(node)) setOpen(false)
    }
    const close = () => setOpen(false)
    const scroll = (event: Event) => { if (!list.current?.contains(event.target as Node)) close() }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [open])

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView?.({ block: 'nearest' })
  }, [active, open])

  return <>
    <button ref={trigger} type="button" role="combobox" className="dsh-usage-select" aria-label={label}
      aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? id : undefined}
      aria-activedescendant={open ? `${id}-${active}` : undefined}
      onClick={() => open ? setOpen(false) : show()}
      onBlur={() => setOpen(false)}
      onKeyDown={event => {
        if (event.key === 'Escape' || event.key === 'Tab') { setOpen(false); return }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (!open) show()
          else setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault(); setOpen(true); setActive(event.key === 'Home' ? 0 : options.length - 1)
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); if (open) choose(active); else show()
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const now = Date.now()
          search.current = { text: (now - search.current.time < 700 ? search.current.text : '') + event.key.toLocaleLowerCase(), time: now }
          const index = options.findIndex(option => option.label.toLocaleLowerCase().startsWith(search.current.text))
          if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true) }
        }
      }}>
      <span title={options[selected]?.label ?? value}>{options[selected]?.label ?? value}</span>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    {open ? createPortal(<div ref={list} id={id} role="listbox" aria-label={label} className="dsh-usage-select-menu" style={position}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value === value}
        className="dsh-usage-select-option" data-active={index === active} onPointerMove={() => setActive(index)}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span title={option.label}>{option.label}</span>
        {option.value === value ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg> : null}
      </div>)}
    </div>, document.body) : null}
  </>
}
