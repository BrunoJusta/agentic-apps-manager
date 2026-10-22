import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { Briefcase, Cube, Kanban, LockKey, LockKeyOpen, MagnifyingGlass, SignOut, Users } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useVault } from '../context/VaultContext'
import { roleLabel } from '../lib/constants'
import { Avatar, Kbd } from './ui'
import { CommandPalette } from './CommandPalette'

/** Marca neutra: na interface de trabalho não há cor de marca. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={clsx('inline-flex size-7 items-center justify-center rounded-lg bg-ink text-canvas', className)}>
      <Cube size={16} weight="bold" />
    </span>
  )
}

function TopTab({ to, children, end, icon }: { to: string; children: ReactNode; end?: boolean; icon: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'relative flex h-full shrink-0 items-center gap-1.5 px-3 font-display text-[13.5px] font-medium transition-colors duration-150',
          isActive ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-ink' : 'text-ink-subtle hover:text-ink',
        )
      }
    >
      <span aria-hidden className="flex">
        {icon}
      </span>
      {children}
    </NavLink>
  )
}

function UserMenu() {
  const { name, email, role, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={`Conta de ${name}`} className="flex size-[34px] items-center justify-center rounded-full transition-transform active:scale-[0.97]">
        <Avatar name={name} className="size-[30px] text-[11px]" />
      </button>
      {open ? (
        <div role="menu" className="enter absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl bg-surface-1 p-1.5 shadow-panel">
          <div className="px-2.5 py-2">
            <p className="truncate font-display text-[13.5px] font-semibold text-ink">{name}</p>
            <p className="truncate text-[12px] text-ink-subtle">{email}</p>
            <p className="mt-1.5">
              <span className="tg">{role ? roleLabel(role) : ''}</span>
            </p>
          </div>
          <div className="my-1 h-px bg-hairline" />
          <button type="button" role="menuitem" onClick={signOut} className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left font-display text-[13.5px] font-medium text-ink hover:bg-sel">
            <SignOut size={16} aria-hidden />
            Terminar sessão
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function Layout() {
  const { isAdmin, canEdit } = useAuth()
  const vault = useVault()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setPaletteOpen(false), [location.pathname])

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  const tabs = (
    <>
      <TopTab to="/" end icon={<Kanban size={15} />}>
        Lifecycle Management
      </TopTab>
      <TopTab to="/production-portfolio" icon={<Briefcase size={15} />}>
        Production Portfolio
      </TopTab>
      {canEdit ? (
        <TopTab to="/credentials-vault" icon={<LockKey size={15} />}>
          Credentials Vault
        </TopTab>
      ) : null}
      {isAdmin ? (
        <TopTab to="/access-control" icon={<Users size={15} />}>
          Access Control
        </TopTab>
      ) : null}
    </>
  )

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-full focus:bg-surface-1 focus:px-4 focus:py-2 focus:shadow-panel">
        Saltar para o conteúdo
      </a>

      <header
        className="sticky top-0 z-30 border-b border-hairline backdrop-blur-[10px]"
        style={{ background: 'color-mix(in srgb, var(--canvas) 88%, transparent)', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-[60px] items-center gap-4" style={{ paddingLeft: 'max(var(--gutter), env(safe-area-inset-left))', paddingRight: 'max(var(--gutter), env(safe-area-inset-right))' }}>
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5 rounded-lg">
            <BrandMark />
            <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">Agentic Hub</span>
          </NavLink>
          <nav aria-label="Principal" className="ml-2 hidden h-full items-stretch md:flex">
            {tabs}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Procurar"
              className="flex h-[34px] items-center gap-2 rounded-full bg-surface-1 px-3 text-[13px] text-ink-subtle shadow-ring transition-colors hover:bg-surface-2 hover:text-ink sm:w-56"
            >
              <MagnifyingGlass size={14} aria-hidden />
              <span className="hidden flex-1 text-left font-sans sm:inline">Procurar…</span>
              <span className="hidden sm:inline">
                <Kbd>{isMac ? '⌘ K' : 'Ctrl K'}</Kbd>
              </span>
            </button>
            {vault.status === 'unlocked' ? (
              <button
                type="button"
                onClick={vault.lock}
                aria-pressed="true"
                title="O Credentials Vault está aberto. Clica para bloquear."
                className="flex h-[34px] items-center gap-1.5 rounded-full bg-warning-soft px-3 font-display text-[13px] font-medium text-warning shadow-[0_0_0_1px_color-mix(in_srgb,var(--warn)_40%,transparent)] transition-transform active:scale-[0.97]"
              >
                <LockKeyOpen size={14} aria-hidden />
                <span className="hidden sm:inline">Credentials Vault aberto</span>
              </button>
            ) : null}
            <UserMenu />
          </div>
        </div>
        <nav aria-label="Principal" className="scroll-x mx-auto flex h-11 items-stretch overflow-x-auto px-1 md:hidden">
          {tabs}
        </nav>
      </header>

      <main id="main" className="pb-16" style={{ paddingLeft: 'max(var(--gutter), env(safe-area-inset-left))', paddingRight: 'max(var(--gutter), env(safe-area-inset-right))' }}>
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

/** Cabeçalho de página: 40px em cima, 24px em baixo, H1 de 32/40. */
export function PageHeader({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pt-10 pb-6">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <h1 className="font-display text-[26px] leading-8 font-semibold tracking-[-0.03em] text-ink min-[760px]:text-[32px] min-[760px]:leading-10">{title}</h1>
          {description ? <p className="mt-1.5 max-w-[70ch] text-sm text-ink-subtle">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  )
}
