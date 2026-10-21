import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowsClockwise, ClockCountdown, Cube, Key, MagnifyingGlass, Plus, Stack, UploadSimple } from '@phosphor-icons/react'
import { FilterChip } from '../components/FiltersBar'
import { useApps } from '../context/AppsContext'
import { useAuth } from '../context/AuthContext'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { daysUntil } from '../lib/app-utils'
import { usageIndex } from '../lib/vault-utils'
import { deleteVaultItem, migrateLegacyToVault } from '../data/store'
import type { VaultItem } from '../lib/types'
import { PageHeader } from '../components/Layout'
import { UnlockDialog, VaultStatusCard } from '../components/VaultGate'
import { ImportEnvDialog, KindIcon, RotationBadge, VaultItemDialog, VaultItemRow } from '../components/VaultItems'
import { Button, ConfirmDialog, EmptyState, Input, Panel } from '../components/ui'

export function VaultPage() {
  const vault = useVault()
  const { apps } = useApps()
  const { canEdit, actor } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [kind, setKind] = useState('')
  const [appFilter, setAppFilter] = useState('')
  const [dlg, setDlg] = useState<{ open: boolean; editing: VaultItem | null }>({ open: false, editing: null })
  const [del, setDel] = useState<VaultItem | null>(null)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [migrating, setMigrating] = useState<string | null>(null)
  const uses = useMemo(() => usageIndex(apps), [apps])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return vault.items.filter((x) => {
      if (kind && x.kind !== kind) return false
      if (appFilter === 'none' ? (uses.get(x.id) ?? []).length > 0 : appFilter && !(uses.get(x.id) ?? []).some((u) => u.app.id === appFilter)) return false
      return !s || x.name.toLowerCase().includes(s) || x.note.toLowerCase().includes(s) || (uses.get(x.id) ?? []).some((u) => u.app.name.toLowerCase().includes(s))
    })
  }, [vault.items, q, kind, appFilter, uses])

  const due = useMemo(
    () =>
      vault.items
        .map((s) => ({ s, d: daysUntil(s.rotateBy) }))
        .filter((x): x is { s: VaultItem; d: number } => x.d !== null && x.d <= 30)
        .sort((a, b) => a.d - b.d),
    [vault.items],
  )

  const legacyVars = apps.reduce((n, a) => n + a.environments.dev.variables.length + a.environments.qa.variables.length + a.environments.prod.variables.length, 0)
  const legacyTotal = legacyVars + vault.legacySecrets.length

  const requireKey = (fn: () => void) => (vault.key ? fn() : setUnlockOpen(true))

  const migrate = async () => {
    if (!vault.key || !vault.meta) return setUnlockOpen(true)
    setMigrating('A começar…')
    try {
      const n = await migrateLegacyToVault(apps, vault.legacySecrets, vault.key, vault.meta.version, actor, setMigrating)
      toast(`${n} itens passaram para o cofre e ficaram ligados às mesmas apps e ambientes.`)
    } catch (e) {
      toast(`A migração parou: ${(e as Error).message}`, 'error')
    } finally {
      setMigrating(null)
    }
  }

  const appOptions = useMemo(() => [...apps].sort((a, b) => a.name.localeCompare(b.name, 'pt')).map((a) => ({ value: a.id, label: a.name })), [apps])

  return (
    <>
      <PageHeader
        title="Cofre"
        description="Todas as variáveis e secrets das apps vivem aqui, cifrados no browser com AES-256-GCM. Cria-os aqui e liga-os às apps; nas fichas só aparece o nome."
        actions={
          canEdit && vault.status !== 'unavailable' ? (
            <>
              <Button variant="ghost" onClick={() => requireKey(() => setImportOpen(true))}>
                <UploadSimple size={16} aria-hidden />
                Importar .env
              </Button>
              <Button variant="primary" onClick={() => requireKey(() => setDlg({ open: true, editing: null }))}>
                <Plus size={16} aria-hidden />
                Novo item
              </Button>
            </>
          ) : null
        }
      />
      <div className="flex flex-col gap-6">
        <VaultStatusCard />

        {vault.status !== 'unavailable' ? (
          <>
            {legacyTotal ? (
              <Panel className="flex flex-wrap items-center gap-3 p-5">
                <ArrowsClockwise size={20} className="text-warning" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-semibold text-ink">Há {legacyTotal} itens no formato antigo</p>
                  <p className="text-[13px] text-ink-muted">
                    {legacyVars} variáveis em texto simples e {vault.legacySecrets.length} secrets guardados dentro das apps. A migração cifra-os no cofre e liga-os às mesmas apps e ambientes. A rotação de chave só funciona depois disto.
                  </p>
                </div>
                <Button variant="primary" onClick={migrate} loading={!!migrating}>
                  {migrating ?? 'Migrar para o cofre'}
                </Button>
              </Panel>
            ) : null}

            {due.length ? (
              <Panel className="p-5">
                <div className="flex items-center gap-2">
                  <ClockCountdown size={18} className="text-warning" aria-hidden />
                  <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">A precisar de rotação</h2>
                  <span className="count">{due.length}</span>
                </div>
                <ul className="mt-3 flex flex-col gap-1">
                  {due.map(({ s }) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setQ(s.name)
                          navigate(`#item-${s.id}`, { replace: true })
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
                      >
                        <KindIcon kind={s.kind} />
                        <span className="font-mono text-[13px] text-ink">{s.name}</span>
                        <span className="min-w-0 flex-1 truncate text-ink-subtle">{(uses.get(s.id) ?? []).map((u) => `${u.app.name} (${u.env.toUpperCase()})`).join(', ') || 'Não ligado'}</span>
                        <RotationBadge rotateBy={s.rotateBy} />
                      </button>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            <section aria-labelledby="all-items">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="all-items" className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">
                  Itens do cofre
                </h2>
                <span className="count">{vault.items.length}</span>
                <div className="ml-auto flex w-full flex-wrap gap-2 sm:w-auto">
                  <div className="relative flex-1 sm:w-72 sm:flex-none">
                    <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-tertiary" aria-hidden />
                    <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, nota ou app" aria-label="Procurar no cofre" className="h-8 pl-8 text-[13px]" spellCheck={false} />
                  </div>
                  <FilterChip icon={<Stack size={14} />} label="Tipo" value={kind} allLabel="Todos" options={[{ value: 'secret', label: 'Secrets' }, { value: 'variable', label: 'Variáveis' }]} onChange={setKind} />
                  <FilterChip icon={<Cube size={14} />} label="App" value={appFilter} allLabel="Todas" align="right" options={[...appOptions, { value: 'none', label: 'Sem app ligada' }]} onChange={setAppFilter} />
                </div>
              </div>
              <Panel className="mt-3 overflow-hidden">
                {!vault.itemsLoaded ? (
                  <p className="px-4 py-6 text-sm text-ink-subtle">A carregar…</p>
                ) : rows.length === 0 ? (
                  <EmptyState
                    icon={<Key size={36} weight="thin" />}
                    title={vault.items.length ? 'Nada encontrado' : 'O cofre está vazio'}
                    body={vault.items.length ? undefined : 'Cria variáveis e secrets aqui, ou importa um .env. Depois liga-os às apps na ficha de cada uma, separador Ambientes e cofre.'}
                  />
                ) : (
                  <ul className="divide-y divide-hairline">
                    {rows.map((s) => (
                      <VaultItemRow key={s.id} item={s} uses={uses.get(s.id) ?? []} requestUnlock={() => setUnlockOpen(true)} onEdit={() => requireKey(() => setDlg({ open: true, editing: s }))} onDelete={() => setDel(s)} />
                    ))}
                  </ul>
                )}
              </Panel>
            </section>
          </>
        ) : null}
      </div>

      <VaultItemDialog
        open={dlg.open}
        onClose={() => setDlg({ open: false, editing: null })}
        editing={dlg.editing}
      />
      <ImportEnvDialog open={importOpen} onClose={() => setImportOpen(false)} apps={apps} />
      <UnlockDialog open={unlockOpen} onClose={() => setUnlockOpen(false)} />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={`Apagar ${del?.name}?`}
        body={
          del && (uses.get(del.id) ?? []).length
            ? `O valor cifrado é apagado de vez e o item sai de ${(uses.get(del.id) ?? []).map((u) => `${u.app.name} (${u.env.toUpperCase()})`).join(', ')}.`
            : 'O valor cifrado é apagado de vez. Não há forma de o recuperar.'
        }
        confirmLabel="Apagar do cofre"
        danger
        onConfirm={async () => {
          if (!del) return
          await deleteVaultItem(del, apps, actor)
          setDel(null)
          toast('Item apagado do cofre.')
        }}
      />
    </>
  )
}
