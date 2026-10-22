import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Cube, Key, MagnifyingGlass, TextAa } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { useVault } from '../context/VaultContext'
import { usageIndex } from '../lib/vault-utils'
import { blurb, matchesSearch } from '../lib/app-utils'
import { statusLabel } from '../lib/constants'
import { Kbd } from './ui'
import { AppIcon } from './AppCard'

interface Item {
  id: string
  kind: 'app' | 'secret' | 'variable'
  title: string
  subtitle: string
  to: string
  app?: { name: string; icon: string; area: string }
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const { apps } = useApps()
  const { items: vaultItems } = useVault()
  const uses = useMemo(() => usageIndex(apps), [apps])
  const navigate = useNavigate()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      setQ('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    if (!open && d.open) d.close()
  }, [open])

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase()
    const out: Item[] = apps
      .filter((a) => matchesSearch(a, s))
      .slice(0, 8)
      .map((a) => ({ id: `a-${a.id}`, kind: 'app', title: a.name, subtitle: `${statusLabel(a.status)}${a.description ? `, ${blurb(a)}` : ''}`, to: `/apps/${a.id}`, app: { name: a.name, icon: a.icon, area: a.area } }))
    if (s) {
      for (const it of vaultItems) {
        if (out.length > 40) break
        if (it.name.toLowerCase().includes(s)) {
          const u = uses.get(it.id) ?? []
          out.push({
            id: `i-${it.id}`,
            kind: it.kind,
            title: it.name,
            subtitle: `${it.kind === 'secret' ? 'Secret' : 'Variável'} no Credentials Vault${u.length ? `, ligado a ${u.map((x) => `${x.app.name} (${x.env.toUpperCase()})`).join(', ')}` : ''}`,
            to: `/credentials-vault?q=${encodeURIComponent(it.name)}#item-${it.id}`,
          })
        }
      }
    }
    return out
  }, [q, apps, vaultItems, uses])

  useEffect(() => setActive(0), [q])

  const go = (it: Item | undefined) => {
    if (!it) return
    onClose()
    navigate(it.to)
  }

  const icon = (k: Item['kind']) => (k === 'app' ? <Cube size={16} /> : k === 'secret' ? <Key size={16} /> : <TextAa size={16} />)

  return (
    <dialog
      ref={ref}
      aria-label="Procurar"
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="mx-auto mt-[12dvh] w-[calc(100%-32px)] max-w-[560px] overflow-hidden rounded-modal bg-surface-1 p-0 shadow-panel"
    >
      {open ? (
        <div>
          <div className="flex items-center gap-2 border-b border-hairline px-4">
            <MagnifyingGlass size={16} className="text-ink-subtle" aria-hidden />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(a + 1, items.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(a - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  go(items[active])
                }
              }}
              placeholder="Procurar apps, secrets ou variáveis pelo nome…"
              aria-label="Procurar apps, secrets ou variáveis"
              aria-controls="palette-list"
              aria-activedescendant={items[active] ? `pal-${items[active].id}` : undefined}
              role="combobox"
              aria-expanded="true"
              className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"
              autoComplete="off"
              spellCheck={false}
            />
            <Kbd>Esc</Kbd>
          </div>
          <ul id="palette-list" role="listbox" className="max-h-[50dvh] overflow-y-auto overscroll-contain p-1.5">
            {items.length === 0 ? (
              <li className="px-3 py-8 text-center text-sm text-ink-subtle">Sem resultados para “{q}”.</li>
            ) : (
              items.map((it, i) => (
                <li
                  key={it.id}
                  id={`pal-${it.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it)}
                  className={clsx('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2', i === active ? 'bg-surface-2' : '')}
                >
                  <span aria-hidden className={clsx('shrink-0', it.kind === 'secret' ? 'text-accent-text' : 'text-ink-subtle')}>
                    {it.app ? <AppIcon app={it.app} size={22} /> : icon(it.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={clsx('block truncate text-sm text-ink', it.kind !== 'app' && 'font-mono text-[13px]')}>{it.title}</span>
                    <span className="block truncate text-xs text-ink-subtle">{it.subtitle}</span>
                  </span>
                </li>
              ))
            )}
          </ul>
          <p className="border-t border-hairline px-4 py-2 text-[11px] text-ink-subtle">A pesquisa usa só nomes. Os valores do Credentials Vault nunca são pesquisáveis.</p>
        </div>
      ) : null}
    </dialog>
  )
}
