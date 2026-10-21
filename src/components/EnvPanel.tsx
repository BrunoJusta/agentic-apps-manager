import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowSquareOut, Copy, Database, DownloadSimple, Globe, HardDrives, LinkSimple, LockKey, Plus, Vault, Warning, X } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useApps } from '../context/AppsContext'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { secretTypeLabel } from '../lib/constants'
import { serializeDotenv } from '../lib/dotenv'
import { linkedItems, usageIndex } from '../lib/vault-utils'
import { logAudit, revealVaultItem, unlinkVaultItem } from '../data/store'
import type { AgenticApp, EnvKey, VaultItem } from '../lib/types'
import { Badge, Button, ConfirmDialog, EmptyState, IconButton, Panel } from './ui'
import { UnlockDialog } from './VaultGate'
import { copyText, KindIcon, RotationBadge, VaultItemDialog, VaultPickerDialog } from './VaultItems'

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function InfoItem({ icon, label, value, href, mono }: { icon: React.ReactNode; label: string; value: string; href?: string; mono?: boolean }) {
  const toast = useToast()
  return (
    <div className="flex min-w-0 items-start gap-3 py-2.5">
      <span className="mt-0.5 text-ink-tertiary" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-ink-subtle">{label}</p>
        {value ? (
          <div className="flex min-w-0 items-center gap-1">
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className={clsx('truncate text-sm text-ink hover:text-accent-text', mono && 'font-mono text-[13px]')}>
                {value}
              </a>
            ) : (
              <span className={clsx('truncate text-sm text-ink', mono && 'font-mono text-[13px]')}>{value}</span>
            )}
            {href ? <ArrowSquareOut size={12} className="shrink-0 text-ink-tertiary" aria-hidden /> : null}
            <IconButton
              label={`Copiar ${label}`}
              className="size-6"
              onClick={async () => {
                await copyText(value)
                toast(`${label} copiado.`)
              }}
            >
              <Copy size={12} aria-hidden />
            </IconButton>
          </div>
        ) : (
          <p className="text-sm text-ink-tertiary">Por definir</p>
        )}
      </div>
    </div>
  )
}

/* ---------------- Painel do ambiente ---------------- */

export function EnvPanel({ app, env }: { app: AgenticApp; env: EnvKey }) {
  const { canEdit, actor } = useAuth()
  const { apps } = useApps()
  const vault = useVault()
  const toast = useToast()
  const e = app.environments[env]
  const items = useMemo(() => linkedItems(app, vault.itemsById, env).map((x) => x.item).sort((a, b) => a.name.localeCompare(b.name)), [app, vault.itemsById, env])
  const uses = useMemo(() => usageIndex(apps), [apps])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [unlink, setUnlink] = useState<VaultItem | null>(null)
  const [busy, setBusy] = useState(false)
  const legacyCount = e.variables.length + vault.legacySecrets.filter((s) => s.appId === app.id && s.env === env).length

  if (!e.enabled) {
    return (
      <Panel>
        <EmptyState icon={<HardDrives size={36} weight="thin" />} title="Este ambiente não existe" body="Ativa-o na ficha da app (Editar, secção Ambientes) para registares base de dados, alojamento e ligares variáveis e secrets do cofre." />
      </Panel>
    )
  }

  const exportEnv = async () => {
    if (!vault.key) return setUnlockOpen(true)
    setBusy(true)
    try {
      const entries: { key: string; value: string; comment?: string }[] = []
      for (const it of items) entries.push({ key: it.name, value: await revealVaultItem(it, vault.key), comment: it.note || undefined })
      download(`.env.${env}`, serializeDotenv(entries, `${app.name} (${env.toUpperCase()})\nExportado em ${new Date().toLocaleString('pt-PT')}. Contém secrets: não partilhes nem faças commit.`))
      await logAudit(actor, 'export_env', { appId: app.id, appName: app.name, env, detail: `${items.length} itens do cofre` })
      toast('Ficheiro .env gerado. Apaga-o quando já não precisares.')
    } catch (err) {
      toast(`Não foi possível exportar: ${(err as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const openCreate = () => {
    setPickerOpen(false)
    if (!vault.key) return setUnlockOpen(true)
    setCreateOpen(true)
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel className="grid grid-cols-1 gap-x-8 px-5 py-2 md:grid-cols-2">
        <InfoItem icon={<Globe size={16} />} label="URL da app" value={e.appUrl} href={e.appUrl || undefined} />
        <InfoItem icon={<HardDrives size={16} />} label="Alojamento" value={e.hosting} />
        <InfoItem icon={<Database size={16} />} label="Base de dados" value={[e.dbType, e.dbProject].filter(Boolean).join(', ')} />
        <InfoItem icon={<Database size={16} />} label="ID da base de dados" value={e.dbId} mono />
        {e.notes ? <p className="border-t border-hairline py-3 text-[13px] whitespace-pre-line text-ink-muted md:col-span-2">{e.notes}</p> : null}
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
          <p className="font-display text-[13.5px] font-semibold text-ink">Variáveis e secrets</p>
          {canEdit ? <span className="count">{items.length}</span> : null}
          {canEdit ? (
            <div className="ml-auto flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={exportEnv} loading={busy} disabled={!items.length}>
                {vault.key ? <DownloadSimple size={14} aria-hidden /> : <LockKey size={14} aria-hidden />}
                Exportar .env
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
                <Plus size={14} aria-hidden />
                Ligar do cofre
              </Button>
            </div>
          ) : null}
        </div>
        {!canEdit ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-subtle">As variáveis e os secrets vivem no cofre e só são visíveis para Editors e Admins.</p>
        ) : !vault.itemsLoaded ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-subtle">A carregar…</p>
        ) : items.length ? (
          <ul className="divide-y divide-hairline">
            {items.map((it) => (
              <li key={it.id} className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2 sm:w-72">
                  <KindIcon kind={it.kind} />
                  <span className="truncate font-mono text-[13px] text-ink" title={it.name}>
                    {it.name}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <Badge>{it.kind === 'secret' ? secretTypeLabel(it.type) : 'Variável'}</Badge>
                  <RotationBadge rotateBy={it.rotateBy} />
                  {it.note ? <span className="min-w-0 truncate text-[12px] text-ink-subtle">{it.note}</span> : null}
                </span>
                <span className="flex items-center gap-0.5 sm:opacity-70 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <Link to={`/cofre?q=${encodeURIComponent(it.name)}#item-${it.id}`} className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink" aria-label={`Ver ${it.name} no cofre`} title="Ver no cofre">
                    <Vault size={16} aria-hidden />
                  </Link>
                  <IconButton label={`Desligar ${it.name} deste ambiente`} onClick={() => setUnlink(it)} className="hover:text-danger">
                    <X size={16} aria-hidden />
                  </IconButton>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <p className="text-[13px] text-ink-subtle">Nenhum item do cofre ligado a {env.toUpperCase()}.</p>
            <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
              <LinkSimple size={14} aria-hidden />
              Escolher do cofre
            </Button>
          </div>
        )}
        {canEdit && legacyCount ? (
          <div className="flex items-center gap-2 border-t border-hairline px-4 py-2.5 text-[12.5px] text-warning">
            <Warning size={14} aria-hidden />
            <span className="flex-1">
              Há {legacyCount} {legacyCount === 1 ? 'item antigo' : 'itens antigos'} guardados dentro desta app.
            </span>
            <Link to="/cofre" className="font-medium underline underline-offset-2">
              Migrar no Cofre
            </Link>
          </div>
        ) : null}
      </Panel>
      {canEdit ? <p className="-mt-2 px-1 text-[12px] text-ink-subtle">A ficha só mostra os nomes. Os valores ficam cifrados no cofre; para os ver ou alterar, abre o Cofre.</p> : null}

      <VaultPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} app={app} env={env} uses={uses} onCreateNew={openCreate} />
      <VaultItemDialog open={createOpen} onClose={() => setCreateOpen(false)} editing={null} linkTo={{ app, env }} />
      <UnlockDialog open={unlockOpen} onClose={() => setUnlockOpen(false)} />
      <ConfirmDialog
        open={!!unlink}
        onClose={() => setUnlink(null)}
        title={`Desligar ${unlink?.name}?`}
        body={`Deixa de estar ligado a ${app.name} (${env.toUpperCase()}). O item continua no cofre e nas outras apps onde estiver ligado.`}
        confirmLabel="Desligar"
        onConfirm={async () => {
          if (!unlink) return
          await unlinkVaultItem(app, env, unlink, actor)
          setUnlink(null)
          toast(`${unlink.name} desligado.`)
        }}
      />
    </div>
  )
}
