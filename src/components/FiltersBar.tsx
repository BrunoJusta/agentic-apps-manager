import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { CaretDown, Check, Funnel, GithubLogo, Gauge, MagnifyingGlass, SquaresFour, Stack, User, Warning, X } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { allTags } from '../lib/app-utils'
import { Dot } from './ui'
import { MATURITIES, PRIORITIES, REPO_ACCOUNTS } from '../lib/constants'
import { useFilters, type GroupBy } from '../lib/filters'

interface Option {
  value: string
  label: string
  color?: string
}

/**
 * Chip com menu. Mostra o nome do filtro e, quando ativo, o valor escolhido em destaque.
 * O menu fecha com Esc, com clique fora, ou ao escolher.
 */
export function FilterChip({
  icon,
  label,
  value,
  options,
  onChange,
  allLabel = 'Todas',
  clearable = true,
  searchable,
  align = 'left',
}: {
  icon: ReactNode
  label: string
  value: string
  options: Option[]
  onChange: (v: string) => void
  allLabel?: string
  clearable?: boolean
  searchable?: boolean
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const active = value !== ''
  const highlighted = active && clearable
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(searchable ? 'input' : '[aria-checked="true"], [role="menuitemradio"]')
      el?.focus()
    })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, searchable])

  const shown = searchable && q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options
  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setQ('')
  }

  const moveFocus = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? items[Math.min(i + 1, items.length - 1)] : items[Math.max(i - 1, 0)]
    next?.focus()
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <div
        className={clsx(
          'flex h-[34px] items-center rounded-full font-display text-[13px] font-medium transition-[background-color,color,box-shadow] duration-150',
          highlighted ? 'bg-ink text-canvas' : 'bg-surface-1 text-ink-muted shadow-ring hover:bg-surface-2 hover:text-ink',
        )}
      >
        <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={clsx('flex h-full items-center gap-1.5 rounded-full pl-3 transition-transform active:scale-[0.97]', active && clearable ? 'pr-1.5' : 'pr-3')}>
          <span aria-hidden className={highlighted ? 'text-canvas/70' : 'text-ink-subtle'}>
            {icon}
          </span>
          <span className={active ? (highlighted ? 'text-canvas/70' : 'text-ink-subtle') : ''}>{label}</span>
          {active ? (
            <span className={clsx('flex max-w-40 items-center gap-1.5 truncate', highlighted ? 'text-canvas' : 'text-ink')}>
              {current?.color ? <Dot color={current.color} /> : null}
              {current?.label ?? value}
            </span>
          ) : null}
          {!active || !clearable ? <CaretDown size={11} className={highlighted ? 'text-canvas/60' : 'text-ink-tertiary'} aria-hidden /> : null}
        </button>
        {active && clearable ? (
          <button type="button" onClick={() => onChange('')} aria-label={`Limpar ${label}`} className="mr-1.5 flex size-5 items-center justify-center rounded-full text-canvas/70 hover:bg-white/15 hover:text-canvas">
            <X size={11} weight="bold" aria-hidden />
          </button>
        ) : null}
      </div>

      {open ? (
        <div ref={listRef} role="menu" aria-label={label} onKeyDown={moveFocus} className={clsx('enter absolute top-full z-40', align === 'right' ? 'right-0' : 'left-0', 'mt-2 w-60 overflow-hidden rounded-xl bg-surface-1 p-1.5 shadow-panel')}>
          {searchable ? (
            <div className="mb-1 flex items-center gap-2 border-b border-hairline px-2 pb-1.5">
              <MagnifyingGlass size={13} className="text-ink-tertiary" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && shown[0]) pick(shown[0].value)
                  moveFocus(e)
                }}
                placeholder={`Procurar ${label.toLowerCase()}…`}
                aria-label={`Procurar ${label.toLowerCase()}`}
                className="h-7 w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-tertiary focus-visible:outline-none"
                autoComplete="off"
              />
            </div>
          ) : null}
          <div className="max-h-64 overflow-y-auto overscroll-contain pt-1">
            {clearable ? (
              <MenuItem checked={value === ''} onClick={() => pick('')}>
                {allLabel}
              </MenuItem>
            ) : null}
            {shown.map((o) => (
              <MenuItem key={o.value} checked={value === o.value} onClick={() => pick(o.value)} color={o.color}>
                {o.label}
              </MenuItem>
            ))}
            {shown.length === 0 ? <p className="px-2.5 py-2 text-[12px] text-ink-subtle">Sem resultados</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({ checked, onClick, children, color }: { checked: boolean; onClick: () => void; children: ReactNode; color?: string }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onClick}
      className={clsx('flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left font-display text-[13px] font-medium outline-none focus-visible:bg-sel', checked ? 'text-ink' : 'text-ink-muted hover:bg-sel hover:text-ink')}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center text-ink" aria-hidden>
        {checked ? <Check size={13} weight="bold" /> : null}
      </span>
      {color ? <Dot color={color} /> : null}
      <span className="truncate">{children}</span>
    </button>
  )
}

export function GroupByChip() {
  const { filters: f, set } = useFilters()
  return (
    <FilterChip
      icon={<SquaresFour size={14} />}
      label="Agrupar por"
      value={f.group}
      clearable={false}
      align="right"
      options={[
        { value: 'status', label: 'Estado' },
        { value: 'maturity', label: 'Maturidade' },
        { value: 'account', label: 'Repositório' },
        { value: 'area', label: 'Área' },
      ]}
      onChange={(v) => set({ group: v as GroupBy })}
    />
  )
}

export function FiltersBar({ trailing }: { trailing?: ReactNode }) {
  const { filters: f, set, active, clear } = useFilters()
  const { apps } = useApps()
  const tags = useMemo(() => [...new Set(apps.flatMap(allTags))].sort((a, b) => a.localeCompare(b, 'pt')), [apps])
  const count = [f.maturity, f.priority, f.account, f.tag, f.mine ? '1' : ''].filter(Boolean).length

  return (
    <div className="flex flex-wrap items-center gap-2 2xl:flex-nowrap">
      <div className="relative w-full sm:w-52 2xl:w-auto 2xl:max-w-60 2xl:min-w-32 2xl:flex-1">
        <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-tertiary" aria-hidden />
        <input
          type="search"
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Filtrar apps…"
          aria-label="Filtrar apps por nome, pessoa ou stack"
          className="h-[34px] w-full rounded-full bg-surface-1 pr-3 pl-8 text-[13px] text-ink shadow-ring placeholder:text-ink-tertiary transition-[box-shadow] duration-150 focus:shadow-[0_0_0_1px_var(--ink),0_0_0_4px_var(--accent-tint)] focus:outline-none focus-visible:outline-none"
          autoComplete="off"
        />
      </div>

      <span aria-hidden className="mx-1 hidden h-5 w-px bg-hairline-strong sm:block" />

      <FilterChip icon={<Gauge size={14} />} label="Maturidade" value={f.maturity} options={MATURITIES.map((m) => ({ value: m.key, label: m.label }))} onChange={(v) => set({ maturity: v as never })} />
      <FilterChip icon={<Warning size={14} />} label="Prioridade" value={f.priority} options={PRIORITIES.map((m) => ({ value: m.key, label: m.label }))} onChange={(v) => set({ priority: v as never })} />
      <FilterChip
        icon={<GithubLogo size={14} />}
        label="Repositório"
        value={f.account}
        allLabel="Todos"
        options={[...REPO_ACCOUNTS.map((m) => ({ value: m.key as string, label: m.label })), { value: 'none', label: 'Sem conta definida' }]}
        onChange={(v) => set({ account: v as never })}
      />
      {tags.length ? <FilterChip icon={<Stack size={14} />} label="Stack" value={f.tag} allLabel="Toda a stack" options={tags.map((t) => ({ value: t, label: t }))} onChange={(v) => set({ tag: v })} searchable /> : null}

      <button
        type="button"
        aria-pressed={f.mine}
        onClick={() => set({ mine: !f.mine })}
        className={clsx(
          'flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3 font-display text-[13px] font-medium whitespace-nowrap transition-[background-color,color] duration-150 active:scale-[0.97]',
          f.mine ? 'bg-ink text-canvas' : 'bg-surface-1 text-ink-muted shadow-ring hover:bg-surface-2 hover:text-ink',
        )}
      >
        <User size={14} className={f.mine ? 'text-canvas/70' : 'text-ink-subtle'} aria-hidden />
        As minhas
      </button>

      {active ? (
        <button type="button" onClick={clear} className="flex h-[30px] shrink-0 items-center gap-1 rounded-full px-2.5 font-display text-[12.5px] font-medium whitespace-nowrap text-ink-subtle transition-colors hover:bg-sel hover:text-ink">
          <Funnel size={13} aria-hidden />
          Limpar{count ? ` (${count})` : ''}
        </button>
      ) : null}

      {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
    </div>
  )
}
