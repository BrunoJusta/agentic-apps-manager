import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClockCounterClockwise, ListBullets, MagnifyingGlass } from '@phosphor-icons/react'
import { FilterChip } from '../components/FiltersBar'
import { subscribeAudit } from '../data/store'
import type { AuditAction, AuditEntry } from '../lib/types'
import { fmtDateTime, fmtRelative } from '../lib/format'
import { PageHeader } from '../components/Layout'
import { Badge, EmptyState, Input, Panel, Skeleton } from '../components/ui'

const LABELS: Record<AuditAction, { label: string; tone: 'neutral' | 'accent' | 'warning' | 'danger' | 'success' }> = {
  login: { label: 'Entrou', tone: 'neutral' },
  reveal: { label: 'Revelou secret', tone: 'accent' },
  copy: { label: 'Copiou secret', tone: 'accent' },
  export_env: { label: 'Exportou .env', tone: 'warning' },
  import_env: { label: 'Importou .env', tone: 'neutral' },
  secret_create: { label: 'Criou secret', tone: 'success' },
  secret_update: { label: 'Alterou secret', tone: 'neutral' },
  secret_delete: { label: 'Apagou secret', tone: 'danger' },
  vault_init: { label: 'Inicializou cofre', tone: 'success' },
  vault_grant: { label: 'Deu acesso ao cofre', tone: 'warning' },
  vault_revoke: { label: 'Retirou acesso', tone: 'neutral' },
  vault_rotate: { label: 'Rodou chave', tone: 'warning' },
  keys_create: { label: 'Criou chaves', tone: 'neutral' },
  keys_reset: { label: 'Repôs chaves', tone: 'warning' },
  user_create: { label: 'Deu acesso à app', tone: 'neutral' },
  user_update: { label: 'Alterou utilizador', tone: 'neutral' },
  app_delete: { label: 'Apagou app', tone: 'danger' },
}

const GROUPS: { key: string; label: string; actions: AuditAction[] }[] = [
  { key: 'secrets', label: 'Acesso a secrets', actions: ['reveal', 'copy', 'export_env'] },
  { key: 'changes', label: 'Alterações a secrets', actions: ['secret_create', 'secret_update', 'secret_delete', 'import_env'] },
  { key: 'vault', label: 'Cofre e chaves', actions: ['vault_init', 'vault_grant', 'vault_revoke', 'vault_rotate', 'keys_create', 'keys_reset'] },
  { key: 'users', label: 'Utilizadores e apps', actions: ['user_create', 'user_update', 'app_delete', 'login'] },
]

export function AuditPage() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null)
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  useEffect(() => subscribeAudit(setRows, () => setRows([])), [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const allowed = GROUPS.find((g) => g.key === group)?.actions
    return (rows ?? []).filter(
      (r) => (!allowed || allowed.includes(r.action)) && (!s || [r.by, r.appName, r.target, r.detail, r.env].filter(Boolean).join(' ').toLowerCase().includes(s)),
    )
  }, [rows, q, group])

  return (
    <>
      <PageHeader title="Auditoria" description="Os últimos 500 eventos. Só Admins veem esta página, e ninguém consegue apagar ou editar registos.">
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-72">
            <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-tertiary" aria-hidden />
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pessoa, app ou secret" aria-label="Filtrar auditoria" className="h-8 pl-8 text-[13px]" />
          </div>
          <FilterChip icon={<ListBullets size={14} />} label="Tipo" value={group} allLabel="Todos os eventos" options={GROUPS.map((g) => ({ value: g.key, label: g.label }))} onChange={setGroup} />
        </div>
      </PageHeader>
      <div>
        {rows === null ? (
          <div className="flex flex-col gap-2" role="status" aria-label="A carregar">
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
            <Skeleton className="h-11" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ClockCounterClockwise size={36} weight="thin" />} title="Sem eventos" />
        ) : (
          <Panel className="overflow-hidden">
            <ul className="divide-y divide-hairline">
              {filtered.map((r) => {
                const l = LABELS[r.action] ?? { label: r.action, tone: 'neutral' as const }
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
                    <span className="w-40 shrink-0 text-ink-subtle tabular" title={fmtDateTime(r.at ?? null)}>
                      {fmtRelative(r.at ?? null)}
                    </span>
                    <span className="w-56 min-w-0 truncate text-ink">{r.by}</span>
                    <Badge tone={l.tone}>{l.label}</Badge>
                    <span className="min-w-0 flex-1 truncate text-ink-muted">
                      {r.target ? <span className="font-mono text-[12px] text-ink">{r.target}</span> : null}
                      {r.appName ? (
                        <>
                          {r.target ? ' em ' : ''}
                          {r.appId ? (
                            <Link to={`/apps/${r.appId}`} className="hover:text-accent-text">
                              {r.appName}
                            </Link>
                          ) : (
                            r.appName
                          )}
                        </>
                      ) : null}
                      {r.env ? ` (${r.env.toUpperCase()})` : ''}
                      {r.detail ? <span className="text-ink-subtle">{(r.target || r.appName) ? ', ' : ''}{r.detail}</span> : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Panel>
        )}
      </div>
    </>
  )
}
