import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { clsx as clsxBase, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CaretDown, CheckCircle, Plus, X } from '@phosphor-icons/react'
import type { Person } from '../lib/types'
import { entityStyle } from '../lib/colors'

const clsx = (...c: ClassValue[]) => twMerge(clsxBase(c))

/* ---------- Botões (tudo o que se clica é pill) ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  loading,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-[7px] rounded-full font-display leading-none font-medium whitespace-nowrap transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.97] disabled:cursor-default disabled:opacity-55',
        size === 'sm' && 'h-[30px] px-3 text-[13px]',
        size === 'md' && 'h-[34px] px-3.5 text-[13.5px]',
        size === 'lg' && 'h-10 px-[18px] text-[13.5px]',
        variant === 'primary' && 'bg-ink text-canvas hover:bg-accent-hover',
        variant === 'secondary' && 'bg-surface-1 text-ink shadow-ring hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-subtle hover:bg-sel hover:text-ink',
        variant === 'danger' && 'bg-danger text-white hover:brightness-95',
        'aria-pressed:bg-warning-soft aria-pressed:text-warning aria-pressed:shadow-[0_0_0_1px_color-mix(in_srgb,var(--warn)_40%,transparent)]',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

/** Botão só com ícone. Por defeito é discreto (sem anel); com `ring` fica como .btn.icon. */
export function IconButton({ label, className, children, ring, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; ring?: boolean }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-subtle transition-[background-color,color,transform] duration-150 hover:bg-sel hover:text-ink active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        ring && 'size-[34px] bg-surface-1 text-ink shadow-ring hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={clsx('inline-block size-3.5 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none', className)} />
}

/** Segmentado: contentor pill com o ativo a tinta. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; count?: number; disabled?: boolean; title?: string }[]
  label: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('seg', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} title={o.title} onClick={() => onChange(o.value)} className={o.disabled ? 'opacity-55' : undefined}>
          {o.label}
          {o.count !== undefined ? <span className="sc">{o.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

/* ---------- Campos ---------- */

const inputBase =
  'w-full min-w-0 rounded-lg border border-hairline bg-surface-1 px-3 text-sm text-ink placeholder:text-ink-tertiary transition-[border-color,box-shadow] duration-150 hover:border-hairline-strong focus:border-ink focus:shadow-[0_0_0_3px_var(--accent-tint)] focus:outline-none focus-visible:outline-none disabled:opacity-55 aria-[invalid=true]:border-danger'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(inputBase, 'min-h-[38px]', className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(inputBase, 'min-h-24 py-2 leading-relaxed', className)} {...rest} />
}

export function Select({ className, wrapperClassName, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }) {
  return (
    <div className={clsx('relative w-full', wrapperClassName)}>
      <select className={clsx(inputBase, 'min-h-[38px] cursor-pointer appearance-none pr-8', className)} {...rest}>
        {children}
      </select>
      <CaretDown size={12} aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-tertiary" />
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
  htmlFor: string
  className?: string
}) {
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="font-display text-[12px] font-medium text-ink-subtle">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[12px] text-ink-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Campo de etiquetas: escreve e carrega Enter (ou vírgula) para adicionar. */
export function TagInput({ id, value, onChange, suggestions = [], placeholder }: { id: string; value: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const listId = `${id}-list`
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, '')
    if (!t) return
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t])
    setDraft('')
  }
  return (
    <div className={clsx(inputBase, 'flex min-h-[38px] flex-wrap items-center gap-1.5 px-1.5 py-1.5 focus-within:border-ink focus-within:shadow-[0_0_0_3px_var(--accent-tint)]')}>
      {value.map((t) => (
        <span key={t} className="tg py-1 pr-1">
          {t}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remover ${t}`} className="flex size-4 items-center justify-center rounded-full text-ink-subtle hover:bg-sel hover:text-ink">
            <X size={10} aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={listId}
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => {
          const v = e.target.value
          if (v.endsWith(',')) add(v)
          else setDraft(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => add(draft)}
        className="h-6 min-w-24 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-ink-tertiary focus-visible:outline-none"
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  )
}

export function PersonInput({ id, value, onChange }: { id: string; value: Person; onChange: (p: Person) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Input id={id} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Nome" autoComplete="off" />
      <Input
        type="email"
        aria-label="Email"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder="nome@sogrape.pt"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}

export function PeopleInput({ id, value, onChange, addLabel }: { id: string; value: Person[]; onChange: (p: Person[]) => void; addLabel: string }) {
  return (
    <div className="flex flex-col gap-2">
      {value.map((p, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <PersonInput id={i === 0 ? id : `${id}-${i}`} value={p} onChange={(np) => onChange(value.map((x, j) => (j === i ? np : x)))} />
          </div>
          <IconButton label="Remover pessoa" onClick={() => onChange(value.filter((_, j) => j !== i))} className="mt-1">
            <X size={14} aria-hidden />
          </IconButton>
        </div>
      ))}
      <div>
        <Button size="sm" variant="ghost" onClick={() => onChange([...value, { name: '', email: '' }])} id={value.length ? undefined : id}>
          <Plus size={14} aria-hidden />
          {addLabel}
        </Button>
      </div>
    </div>
  )
}

/* ---------- Etiquetas e estado ---------- */

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

/**
 * Etiqueta (.tg). Com `color` passa a etiqueta de entidade: tint suave, ponto e texto contrastado.
 */
export function Badge({ tone = 'neutral', color, mono, children, className, title }: { tone?: Tone; color?: string; mono?: boolean; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      style={entityStyle(color)}
      className={clsx('tg', color && 'ar', tone === 'success' && 'ok', tone === 'warning' && 'star', tone === 'danger' && 'no', mono && 'mn', className)}
    >
      {children}
    </span>
  )
}

export function StatusPill({ tone, children, title }: { tone: 'ok' | 'no' | 'warn' | 'run'; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`pill st-${tone}`}>
      {children}
    </span>
  )
}

export function Dot({ color, className }: { color?: string; className?: string }) {
  return <span aria-hidden className={clsx('dot inline-block', className)} style={entityStyle(color ?? 'var(--ink-tertiary)')} />
}

/* ---------- Superfícies ---------- */

export function Panel({ children, className, as: As = 'section', style }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; style?: React.CSSProperties }) {
  return (
    <As style={style} className={clsx('rounded-card bg-surface-1 shadow-e2', className)}>
      {children}
    </As>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-[72px] text-center sm:py-24">
      <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
        {icon ?? <CheckCircle size={22} />}
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">{title}</p>
        {body ? <p className="text-sm text-ink-subtle">{body}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx('skeleton rounded-lg', className)} />
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-hairline-strong bg-surface-1 px-1.5 py-px font-mono text-[11px] text-ink-subtle">{children}</kbd>
}

/** Velocímetro: arco em três segmentos; o ativo fica opaco, os outros a 22%. */
export function Gauge({ value, max, label }: { value: number; max: number; label: string }) {
  const r = max ? value / max : 0
  const active = r >= 0.9 ? 2 : r >= 0.5 ? 1 : 0
  const colors = ['#D93036', '#C98A00', '#1A7F37']
  // três arcos de 60º cada, de 180º a 0º
  const arc = (from: number, to: number) => {
    const p = (a: number) => [50 + 40 * Math.cos((a * Math.PI) / 180), 50 - 40 * Math.sin((a * Math.PI) / 180)]
    const [x1, y1] = p(from)
    const [x2, y2] = p(to)
    return `M ${x1} ${y1} A 40 40 0 0 1 ${x2} ${y2}`
  }
  const needle = 180 - 180 * r
  const nx = 50 + 30 * Math.cos((needle * Math.PI) / 180)
  const ny = 50 - 30 * Math.sin((needle * Math.PI) / 180)
  return (
    <figure className="flex flex-col items-center" aria-label={`${label}: ${value} de ${max}`}>
      <svg viewBox="0 0 100 56" className="w-36" aria-hidden>
        <path d={arc(180, 0)} fill="none" stroke="rgba(23,23,23,.08)" strokeWidth="8" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={arc(180 - i * 60 - (i ? 1 : 0), 180 - (i + 1) * 60 + (i < 2 ? 1 : 0))} fill="none" stroke={colors[i]} strokeOpacity={i === active ? 1 : 0.22} strokeWidth="8" />
        ))}
        <line x1="50" y1="50" x2={nx} y2={ny} stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="50" cy="50" r="3.5" fill="var(--ink)" />
      </svg>
      <figcaption className="mono -mt-1 text-[13px] text-ink">
        {value}
        <span className="text-ink-tertiary">/{max}</span>
      </figcaption>
    </figure>
  )
}

/* ---------- Modal (dialog nativo: foco e Esc tratados pelo browser) ---------- */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={clsx(
        'm-auto max-h-[calc(100dvh-48px)] w-[calc(100%-32px)] overflow-hidden rounded-modal bg-surface-1 p-0 shadow-panel',
        size === 'sm' && 'max-w-[440px]',
        size === 'md' && 'max-w-[560px]',
        size === 'lg' && 'max-w-[820px]',
      )}
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-48px)] flex-col">
          <div className="flex items-start gap-3 border-b border-hairline px-5 py-[18px]">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-display text-lg font-semibold tracking-[-0.02em] text-ink">
                {title}
              </h2>
              {description ? <div className="mt-1 text-sm text-ink-subtle">{description}</div> : null}
            </div>
            <IconButton label="Fechar" onClick={onClose} className="-mt-0.5 -mr-1.5">
              <X size={16} aria-hidden />
            </IconButton>
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-[18px]">{children}</div> : null}
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-5 py-3.5">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  danger,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: ReactNode
  confirmLabel: string
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-muted">{body}</div>
    </Dialog>
  )
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span aria-hidden className={clsx('inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-[10px] font-semibold text-ink-muted shadow-ring', className)}>
      {initials || '?'}
    </span>
  )
}
