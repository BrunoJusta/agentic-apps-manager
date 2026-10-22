import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { clsx as clsxBase, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CaretDown, Check, MagnifyingGlass, Plus, X } from '@phosphor-icons/react'

const clsx = (...c: ClassValue[]) => twMerge(clsxBase(c))

/* ---------- Pills: escolha única, quebra de linha em ecrãs pequenos ---------- */

export function PillPicker<T extends string>({
  id,
  value,
  onChange,
  options,
  label,
  describedBy,
}: {
  id?: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  label: string
  describedBy?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selIdx = options.findIndex((o) => o.value === value)
  const tabIdx = selIdx >= 0 ? selIdx : 0
  // Setas movem e escolhem (semântica de radio); só a opção escolhida entra no Tab.
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const n = options.length
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % n
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + n) % n
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    if (next < 0) return
    e.preventDefault()
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div id={id} role="radiogroup" aria-label={label} aria-describedby={describedBy} className="flex flex-wrap gap-1.5">
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === tabIdx ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={clsx(
              'inline-flex h-[34px] items-center gap-1.5 rounded-full px-3.5 font-display text-[13px] font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97]',
              on ? 'bg-accent-soft text-ink shadow-[inset_0_0_0_1px_var(--accent-line)]' : 'bg-surface-1 text-ink-muted shadow-ring hover:bg-surface-2 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Switch ---------- */

export function Switch({ id, checked, onChange, label, description }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer select-none">
        <span className="block text-sm text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-[12px] text-ink-tertiary">{description}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-surface-3 shadow-[inset_0_0_0_1px_var(--hairline-strong)]',
        )}
      >
        <span aria-hidden className={clsx('inline-block size-[18px] rounded-full bg-white shadow-e2 transition-transform duration-200', checked ? 'translate-x-[19px]' : 'translate-x-[3px]')} />
      </button>
    </div>
  )
}

/* ---------- Dropdown com pesquisa e opção de adicionar ---------- */

function useOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close()
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open, ref, close])
}

/** Lista de opções filtradas + "Adicionar …" quando o texto não existe. */
function OptionList({
  listId,
  query,
  options,
  selected,
  active,
  setActive,
  onPick,
}: {
  listId: string
  query: string
  options: string[]
  selected: string[]
  active: number
  setActive: (i: number) => void
  onPick: (v: string) => void
}) {
  const q = query.trim()
  const items = useMemo(() => buildItems(options, q), [options, q])
  return (
    <ul id={listId} role="listbox" className="enter absolute top-full right-0 left-0 z-40 mt-1.5 max-h-64 overflow-y-auto rounded-xl bg-surface-1 p-1.5 shadow-panel">
      {items.length === 0 ? <li className="px-2.5 py-2 text-[13px] text-ink-tertiary">Escreve para adicionar uma nova opção</li> : null}
      {items.map((it, i) => {
        const isSel = selected.some((s) => s.toLowerCase() === it.value.toLowerCase())
        return (
          <li
            key={`${it.add ? '+' : ''}${it.value}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={isSel}
            onPointerDown={(e) => e.preventDefault()}
            onPointerEnter={() => setActive(i)}
            onClick={() => onPick(it.value)}
            className={clsx('flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-[13.5px] text-ink', i === active && 'bg-sel')}
          >
            {it.add ? (
              <>
                <Plus size={14} className="shrink-0 text-ink-subtle" aria-hidden />
                <span className="min-w-0 truncate">
                  Adicionar <span className="font-medium">“{it.value}”</span>
                </span>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">{it.value}</span>
                {isSel ? <Check size={14} className="shrink-0 text-ink" aria-hidden /> : null}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function buildItems(options: string[], q: string) {
  const ql = q.toLowerCase()
  const uniq = [...new Set(options.map((o) => o.trim()).filter(Boolean))]
  const matches = ql ? uniq.filter((o) => o.toLowerCase().includes(ql)) : uniq
  const exact = uniq.some((o) => o.toLowerCase() === ql)
  const items: { value: string; add?: boolean }[] = matches.map((value) => ({ value }))
  if (q && !exact) items.push({ value: q, add: true })
  return items
}

function useComboKeys(options: string[], query: string, open: boolean, setOpen: (o: boolean) => void, onPick: (v: string) => void) {
  const [active, setActive] = useState(0)
  const items = useMemo(() => buildItems(options, query.trim()), [options, query])
  useEffect(() => setActive(0), [query, open])
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setActive(Math.min(active + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(Math.max(active - 1, 0))
    } else if (e.key === 'Enter') {
      if (!open) return
      e.preventDefault()
      const it = items[active]
      if (it) onPick(it.value)
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }
  return { active, setActive, onKeyDown, count: items.length }
}

const boxBase =
  'w-full min-w-0 rounded-lg border border-hairline bg-surface-1 text-sm text-ink transition-[border-color,box-shadow] duration-150 hover:border-hairline-strong focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-tint)]'

/** Escolha única com pesquisa. Se o texto não existir, oferece "Adicionar". */
export function Combobox({ id, value, onChange, options, placeholder = 'Procurar ou adicionar…' }: { id: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const close = () => {
    setOpen(false)
    setQuery('')
  }
  useOutside(ref, open, close)
  const pick = (v: string) => {
    onChange(v)
    close()
    inputRef.current?.blur()
  }
  const all = useMemo(() => (value && !options.includes(value) ? [value, ...options] : options), [options, value])
  const keys = useComboKeys(all, query, open, setOpen, pick)
  return (
    <div ref={ref} className="relative">
      <div className={clsx(boxBase, 'flex min-h-[38px] items-center gap-2 px-3')}>
        {open ? <MagnifyingGlass size={14} className="shrink-0 text-ink-tertiary" aria-hidden /> : null}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && keys.count ? `${listId}-${keys.active}` : undefined}
          value={open ? query : value}
          placeholder={open ? value || placeholder : placeholder}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={keys.onKeyDown}
          onBlur={close}
          className="h-9 min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-tertiary focus-visible:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {value && !open ? (
          <button type="button" onClick={() => onChange('')} aria-label={`Limpar ${value}`} className="-mr-1.5 flex size-7 items-center justify-center rounded-full text-ink-tertiary transition-colors hover:bg-sel hover:text-ink">
            <X size={11} aria-hidden />
          </button>
        ) : (
          <CaretDown size={12} aria-hidden className="shrink-0 text-ink-tertiary" />
        )}
      </div>
      {open ? <OptionList listId={listId} query={query} options={all} selected={value ? [value] : []} active={keys.active} setActive={keys.setActive} onPick={pick} /> : null}
    </div>
  )
}

/** Escolha múltipla (etiquetas) com pesquisa. Se o texto não existir, oferece "Adicionar". */
export function MultiCombobox({ id, value, onChange, options, placeholder = 'Procurar ou adicionar…' }: { id: string; value: string[]; onChange: (v: string[]) => void; options: string[]; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()
  const close = () => {
    setOpen(false)
    setQuery('')
  }
  useOutside(ref, open, close)
  const toggle = (v: string) => {
    const has = value.find((x) => x.toLowerCase() === v.toLowerCase())
    onChange(has ? value.filter((x) => x !== has) : [...value, v])
    setQuery('')
  }
  const all = useMemo(() => [...new Set([...options, ...value])], [options, value])
  const keys = useComboKeys(all, query, open, setOpen, toggle)
  return (
    <div ref={ref} className="relative">
      <label htmlFor={id} className={clsx(boxBase, 'flex min-h-[38px] cursor-text flex-wrap items-center gap-1.5 px-1.5 py-1.5')}>
        {value.map((t) => (
          <span key={t} className="tg py-1 pr-1">
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange(value.filter((v) => v !== t))
              }}
              aria-label={`Remover ${t}`}
              className="flex size-4 items-center justify-center rounded-full text-ink-subtle hover:bg-sel hover:text-ink"
            >
              <X size={10} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && keys.count ? `${listId}-${keys.active}` : undefined}
          value={query}
          placeholder={value.length ? '' : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !query && value.length) onChange(value.slice(0, -1))
            else keys.onKeyDown(e)
          }}
          onBlur={close}
          className="h-6 min-w-24 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-ink-tertiary focus-visible:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {open ? <OptionList listId={listId} query={query} options={all} selected={value} active={keys.active} setActive={keys.setActive} onPick={toggle} /> : null}
    </div>
  )
}
