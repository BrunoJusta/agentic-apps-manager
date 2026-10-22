import { useEffect, useId, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { CaretDown, Check, MagnifyingGlass, X } from '@phosphor-icons/react'
import { subscribeUsers } from '../data/store'
import { nameFromEmail } from '../lib/app-utils'
import type { Person, UserProfile } from '../lib/types'
import { Avatar, Input } from './ui'

/** Editors e Admins ativos em Access Control (quem pode ser AI Lead). */
export function useEditorsDirectory() {
  const [rows, setRows] = useState<UserProfile[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(
    () =>
      subscribeUsers(
        (r) => {
          setRows(r)
          setFailed(false)
        },
        () => setFailed(true),
      ),
    [],
  )
  const people = useMemo<Person[]>(
    () =>
      (rows ?? [])
        .filter((u) => u.active && (u.role === 'admin' || u.role === 'editor'))
        .map((u) => ({ name: u.displayName || nameFromEmail(u.email), email: u.email }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    [rows],
  )
  return { people, loading: rows === null && !failed, failed }
}

const boxBase =
  'w-full min-w-0 rounded-lg border border-hairline bg-surface-1 text-sm text-ink transition-[border-color,box-shadow] duration-150 hover:border-hairline-strong focus-within:border-ink focus-within:shadow-[0_0_0_3px_var(--accent-tint)]'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Escolha de uma pessoa de Access Control (Editors e Admins), com pesquisa por nome ou email.
 * Se a lista não puder ser lida, cai para email + nome automático.
 */
export function AiLeadPicker({ id, value, onChange, invalid, describedBy }: { id: string; value: Person; onChange: (p: Person) => void; invalid?: boolean; describedBy?: string }) {
  const { people, loading, failed } = useEditorsDirectory()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const matches = useMemo(() => {
    const q = norm(query.trim())
    return q ? people.filter((p) => norm(`${p.name} ${p.email}`).includes(q)) : people
  }, [people, query])

  useEffect(() => setActive(0), [query, open])
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open])

  if (failed) return <EmailPersonInput id={id} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} />

  const close = () => {
    setOpen(false)
    setQuery('')
  }
  const pick = (p: Person) => {
    onChange(p)
    close()
    inputRef.current?.blur()
  }
  const hasValue = !!(value.name || value.email)

  return (
    <div ref={ref} className="relative">
      <div className={clsx(boxBase, 'flex min-h-[44px] items-center gap-2.5 px-2.5', invalid && 'border-danger')}>
        {open || !hasValue ? (
          <MagnifyingGlass size={15} className="ml-0.5 shrink-0 text-ink-tertiary" aria-hidden />
        ) : (
          <Avatar name={value.name || value.email} className="size-7 text-[10.5px]" />
        )}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-activedescendant={open && matches.length ? `${listId}-${active}` : undefined}
          value={open ? query : value.name || value.email}
          placeholder={open ? 'Procurar por nome ou email…' : loading ? 'A carregar pessoas…' : 'Escolher pessoa…'}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onBlur={close}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!open) setOpen(true)
              else setActive((a) => Math.min(a + 1, matches.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter' && open) {
              e.preventDefault()
              const p = matches[active]
              if (p) pick(p)
            } else if (e.key === 'Escape' && open) {
              e.preventDefault()
              close()
            }
          }}
          className="h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-tertiary focus-visible:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        {!open && value.email ? <span className="hidden max-w-[45%] truncate text-[12px] text-ink-tertiary sm:inline">{value.email}</span> : null}
        {hasValue && !open ? (
          <button
            type="button"
            onClick={() => onChange({ name: '', email: '' })}
            aria-label="Limpar pessoa escolhida"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-tertiary transition-colors hover:bg-sel hover:text-ink"
          >
            <X size={12} aria-hidden />
          </button>
        ) : (
          <CaretDown size={12} aria-hidden className="mr-1 shrink-0 text-ink-tertiary" />
        )}
      </div>
      {open ? (
        <ul id={listId} role="listbox" aria-label="Pessoas" className="enter absolute top-full right-0 left-0 z-40 mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-xl bg-surface-1 p-1.5 shadow-panel">
          {matches.length === 0 ? (
            <li className="px-2.5 py-2.5 text-[13px] text-ink-tertiary">{loading ? 'A carregar…' : 'Ninguém com esse nome. Só Editors e Admins de Access Control podem ser AI Lead.'}</li>
          ) : null}
          {matches.map((p, i) => {
            const sel = p.email.toLowerCase() === value.email.toLowerCase()
            return (
              <li
                key={p.email}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={sel}
                onPointerDown={(e) => e.preventDefault()}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(p)}
                className={clsx('flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5', i === active && 'bg-sel')}
              >
                <Avatar name={p.name} className="size-7 text-[10.5px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">{p.name}</span>
                  <span className="block truncate text-[12px] text-ink-subtle">{p.email}</span>
                </span>
                {sel ? <Check size={14} className="shrink-0 text-ink" aria-hidden /> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * Pessoa por email: os emails da Sogrape são nome.apelido@sogrape.pt, por isso o nome
 * preenche-se sozinho enquanto não for alterado à mão (e pode corrigir-se, por exemplo acentos).
 */
export function EmailPersonInput({ id, value, onChange, invalid, describedBy }: { id: string; value: Person; onChange: (p: Person) => void; invalid?: boolean; describedBy?: string }) {
  const autoName = nameFromEmail(value.email)
  const nameIsAuto = !value.name || value.name === autoName
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Input
        id={id}
        type="email"
        inputMode="email"
        value={value.email}
        onChange={(e) => {
          const email = e.target.value.trim().toLowerCase()
          onChange({ email, name: nameIsAuto ? nameFromEmail(email) : value.name })
        }}
        placeholder="nome.apelido@sogrape.pt"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="relative">
        <Input aria-label="Nome" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Nome, preenchido pelo email" autoComplete="off" className={value.name ? 'pl-10' : undefined} />
        {value.name ? (
          <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2">
            <Avatar name={value.name} className="size-6 text-[9.5px]" />
          </span>
        ) : null}
      </div>
    </div>
  )
}
