import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  Info,
  HardDrives,
  UsersThree,
  ShieldCheck,
  ArrowLeft,
  Copy,
  ArrowSquareOut,
  CheckCircle,
  Circle,
  ClockCounterClockwise,
  Flag,
  GithubLogo,
  LinkSimple,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useVault } from '../context/VaultContext'
import { productionReadiness } from '../lib/app-utils'
import { ENVS, maturityLabel, PERSONAL_DATA, priorityLabel, repoAccountLabel, STATUSES, statusLabel } from '../lib/constants'
import { fmtDate, fmtDateTime, fmtEur, fmtNumber, fmtRelative } from '../lib/format'
import { deleteApp, moveApp, subscribeHistory } from '../data/store'
import type { AgenticApp, EnvKey, HistoryEntry, Person, StatusKey } from '../lib/types'
import { Avatar, Badge, Button, ConfirmDialog, EmptyState, Gauge, IconButton, Panel, Segmented, Skeleton } from '../components/ui'
import { areaColor, entityStyle, STATUS_COLORS } from '../lib/colors'
import { FilterChip } from '../components/FiltersBar'
import { AppIcon, PriorityIcon, rotationDue } from '../components/AppCard'
import { EnvPanel } from '../components/EnvPanel'

const TABS = [
  { key: 'geral', label: 'Visão geral', icon: Info },
  { key: 'ambientes', label: 'Ambientes e cofre', icon: HardDrives },
  { key: 'pessoas', label: 'Pessoas', icon: UsersThree },
  { key: 'governo', label: 'Governance', icon: ShieldCheck },
  { key: 'historico', label: 'Histórico', icon: ClockCounterClockwise },
] as const
type TabKey = (typeof TABS)[number]['key']

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-ink-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink">{children || <span className="text-ink-tertiary">Por definir</span>}</dd>
    </div>
  )
}

function PersonLine({ p }: { p: Person }) {
  if (!p.name && !p.email) return <p className="text-sm text-ink-tertiary">Por definir</p>
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={p.name || p.email} className="size-7" />
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{p.name || p.email}</p>
        {p.email ? (
          <a href={`mailto:${p.email}`} className="block truncate text-[12px] text-ink-subtle hover:text-accent-text">
            {p.email}
          </a>
        ) : null}
      </div>
    </div>
  )
}

/** Links rápidos para a app em cada ambiente (só os que têm URL). */
function EnvUrlLinks({ app }: { app: AgenticApp }) {
  const links = ENVS.filter((e) => app.environments[e.key].enabled && app.environments[e.key].appUrl)
  if (!links.length) return null
  return (
    <div className="seg" role="group" aria-label="Abrir a app">
      {links.map((e) => (
        <a
          key={e.key}
          href={app.environments[e.key].appUrl}
          target="_blank"
          rel="noreferrer"
          title={`Abrir em ${e.label}: ${app.environments[e.key].appUrl}`}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 font-display text-[13px] font-medium text-ink-muted transition-colors duration-150 hover:bg-sel hover:text-ink"
        >
          <span className="font-mono text-[11.5px] tracking-wide">{e.short}</span>
          <ArrowSquareOut size={13} aria-hidden />
        </a>
      ))}
    </div>
  )
}

/** URLs da app por ambiente, com copiar. */
function EnvUrls({ app }: { app: AgenticApp }) {
  const toast = useToast()
  return (
    <Panel className="p-5">
      <h2 className="font-display text-[13px] font-semibold text-ink">URLs da app</h2>
      <ul className="mt-2 divide-y divide-hairline">
        {ENVS.map((e) => {
          const env = app.environments[e.key]
          return (
            <li key={e.key} className="flex min-w-0 items-center gap-3 py-2.5">
              <span className="tg mn w-14 justify-center">{e.short}</span>
              {env.enabled && env.appUrl ? (
                <>
                  <a href={env.appUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-ink hover:underline">
                    {env.appUrl}
                  </a>
                  <IconButton
                    label={`Copiar URL de ${e.label}`}
                    onClick={async () => {
                      await navigator.clipboard.writeText(env.appUrl)
                      toast(`URL de ${e.label} copiado.`)
                    }}
                  >
                    <Copy size={14} aria-hidden />
                  </IconButton>
                  <a href={env.appUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${e.label}`} title={`Abrir ${e.label}`} className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-sel hover:text-ink">
                    <ArrowSquareOut size={14} aria-hidden />
                  </a>
                </>
              ) : (
                <span className="flex-1 text-sm text-ink-tertiary">{env.enabled ? 'Por definir' : 'Este ambiente não existe'}</span>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function Overview({ app }: { app: AgenticApp }) {
  const r = productionReadiness(app)
  const done = r.items.filter((i) => i.ok).length
  const stackGroups: [string, string[]][] = [
    ['Frontend', app.stack.frontend],
    ['Backend', app.stack.backend],
    ['Modelos de IA', app.stack.llm],
    ['Frameworks de agentes', app.stack.frameworks],
  ]
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <EnvUrls app={app} />
        <Panel className="p-5">
          <h2 className="font-display text-[13px] font-semibold text-ink">Descrição</h2>
          {app.description ? <p className="mt-2 max-w-[70ch] text-sm leading-relaxed whitespace-pre-line text-ink">{app.description}</p> : <p className="mt-2 text-sm text-ink-tertiary">Ainda sem descrição.</p>}
        </Panel>
        <Panel className="p-5">
          <h2 className="font-display text-[13px] font-semibold text-ink">Stack</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {stackGroups.map(([label, tags]) => (
              <div key={label}>
                <p className="text-[12px] text-ink-subtle">{label}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {tags.length ? tags.map((t) => <Badge key={t}>{t}</Badge>) : <span className="text-sm text-ink-tertiary">Nada registado</span>}
                </div>
              </div>
            ))}
          </div>
          {app.stack.auth ? <p className="mt-4 text-sm text-ink-muted">Autenticação: {app.stack.auth}</p> : null}
        </Panel>
        <Panel className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-1 sm:w-40">
            <Gauge value={done} max={r.items.length} label="Pronta para Produção" />
            <p className="font-display text-[12px] font-medium text-ink-subtle">Pronta para Produção</p>
          </div>
          <ul className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {r.items.map((i) => (
              <li key={i.label} className="flex items-center gap-2 text-[13px]">
                {i.ok ? <CheckCircle size={16} weight="fill" className="shrink-0 text-success" aria-label="Feito" /> : <Circle size={16} className="shrink-0 text-ink-tertiary" aria-label="Em falta" />}
                <span className={i.ok ? 'text-ink-subtle' : 'text-ink'}>{i.label}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel className="h-fit p-5">
        <dl className="divide-y divide-hairline">
          <Fact label="Área">{app.area}</Fact>
          <Fact label="Início">{fmtDate(app.startDate)}</Fact>
          <Fact label="Go-live">{fmtDate(app.goLiveDate)}</Fact>
          <Fact label="Utilizadores ativos">{fmtNumber(app.activeUsers)}</Fact>
          <Fact label="AI Lead">{app.aiLead.name}</Fact>
          <Fact label="Dono de negócio">{app.businessOwner.name}</Fact>
          <Fact label="Repositório">{app.repo.account ? repoAccountLabel(app.repo.account) : ''}</Fact>
          <Fact label="Custo mensal">{fmtEur(app.governance.monthlyCost)}</Fact>
        </dl>
        {app.repo.url ? (
          <a href={app.repo.url} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 rounded-full bg-surface-1 px-3.5 py-2 font-display text-[13px] font-medium text-ink shadow-ring transition-colors hover:bg-surface-2">
            <GithubLogo size={16} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{app.repo.url.replace(/^https?:\/\/(www\.)?github\.com\//, '')}</span>
            <ArrowSquareOut size={12} className="text-ink-tertiary" aria-hidden />
          </a>
        ) : null}
      </Panel>
    </div>
  )
}

function People({ app }: { app: AgenticApp }) {
  const groups: [string, Person[]][] = [
    ['Dono de negócio', [app.businessOwner]],
    ['AI Lead', [app.aiLead]],
    ['Devs', app.developers],
    ['Suporte nível 1', app.supportL1],
    ['Suporte nível 2', app.supportL2],
  ]
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map(([label, people]) => (
        <Panel key={label} className="p-4">
          <h2 className="font-display text-[13px] font-semibold text-ink">{label}</h2>
          <div className="mt-3 flex flex-col gap-3">{people.length ? people.map((p, i) => <PersonLine key={i} p={p} />) : <p className="text-sm text-ink-tertiary">Por definir</p>}</div>
        </Panel>
      ))}
    </div>
  )
}

function Governance({ app }: { app: AgenticApp }) {
  const pd = PERSONAL_DATA.find((p) => p.key === app.governance.personalData)
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel className="p-5">
        <h2 className="font-display text-[13px] font-semibold text-ink">Links</h2>
        {app.links.length ? (
          <ul className="mt-3 flex flex-col gap-1">
            {app.links.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink transition-colors hover:bg-surface-2">
                  <LinkSimple size={14} className="text-ink-tertiary" aria-hidden />
                  <span className="font-medium">{l.label || 'Link'}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink-subtle">{l.url}</span>
                  <ArrowSquareOut size={12} className="text-ink-tertiary" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-tertiary">Sem links.</p>
        )}
      </Panel>
      <Panel className="p-5">
        <h2 className="font-display text-[13px] font-semibold text-ink">Governance</h2>
        <dl className="mt-1 divide-y divide-hairline">
          <Fact label="Dados pessoais (RGPD)">
            <Badge tone={app.governance.personalData === 'sim' ? 'warning' : app.governance.personalData === 'nao' ? 'success' : 'neutral'}>{pd?.label}</Badge>
          </Fact>
          <Fact label="Classificação">{app.governance.dataClassification}</Fact>
          <Fact label="Custo mensal">{fmtEur(app.governance.monthlyCost)}</Fact>
        </dl>
        {app.governance.risks ? (
          <>
            <h3 className="mt-4 text-[12px] text-ink-subtle">Riscos</h3>
            <p className="mt-1 text-sm whitespace-pre-line text-ink">{app.governance.risks}</p>
          </>
        ) : null}
        {app.governance.notes ? (
          <>
            <h3 className="mt-4 text-[12px] text-ink-subtle">Notas</h3>
            <p className="mt-1 text-sm whitespace-pre-line text-ink">{app.governance.notes}</p>
          </>
        ) : null}
      </Panel>
    </div>
  )
}

function History({ appId }: { appId: string }) {
  const [rows, setRows] = useState<HistoryEntry[] | null>(null)
  useEffect(() => subscribeHistory(appId, setRows, () => setRows([])), [appId])
  if (!rows)
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="A carregar">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    )
  if (!rows.length) return <EmptyState icon={<ClockCounterClockwise size={36} weight="thin" />} title="Sem histórico" />
  return (
    <Panel className="px-5 py-2">
      <ol className="relative">
        {rows.map((h, i) => (
          <li key={h.id} className="relative flex gap-3 py-3">
            {i < rows.length - 1 ? <span aria-hidden className="absolute top-8 bottom-0 left-[11px] w-px bg-hairline" /> : null}
            <Avatar name={h.byName || h.by} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="font-medium">{h.byName || h.by}</span> <span className="text-ink-muted">{h.summary.charAt(0).toLowerCase() + h.summary.slice(1)}</span>
              </p>
              <p className="text-[12px] text-ink-subtle" title={fmtDateTime(h.at ?? null)}>
                {fmtRelative(h.at ?? null)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

export function AppDetailPage() {
  const { id } = useParams()
  const { byId, loading } = useApps()
  const { canEdit, isAdmin, actor } = useAuth()
  const { secrets } = useVault()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const app = id ? byId(id) : undefined
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'geral') as TabKey
  const env = (['dev', 'qa', 'prod'].includes(params.get('env') ?? '') ? params.get('env') : app?.environments.prod.enabled ? 'prod' : 'dev') as EnvKey
  const appSecrets = useMemo(() => secrets.filter((s) => s.appId === id), [secrets, id])
  const due = rotationDue(appSecrets)

  const setTab = (t: TabKey) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (t === 'geral') n.delete('tab')
        else n.set('tab', t)
        if (t !== 'ambientes') n.delete('env')
        return n
      },
      { replace: true },
    )
  const setEnv = (e: EnvKey) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('tab', 'ambientes')
        n.set('env', e)
        return n
      },
      { replace: true },
    )

  if (loading)
    return (
      <div className="flex flex-col gap-3 py-10" role="status" aria-label="A carregar">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="mt-6 h-48" />
      </div>
    )
  if (!app) return <EmptyState title="Esta app não existe ou foi apagada." action={<Link to="/" className="text-sm text-accent-text underline underline-offset-2">Voltar ao board</Link>} />

  const changeStatus = async (s: StatusKey) => {
    if (s === 'producao' && !productionReadiness(app).ready) {
      toast('Completa a ficha antes de passar para Produção. O que falta está em “Pronta para Produção”.', 'error')
      setTab('geral')
      return
    }
    try {
      await moveApp(app, 'status', s, actor)
      toast(`Estado alterado para ${statusLabel(s)}.`)
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }


  return (
    <div className="enter" style={entityStyle(areaColor(app.area))}>
      <div className="relative border-b border-hairline pt-8">
        <div aria-hidden className="pointer-events-none absolute -inset-x-4 -top-px h-40 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--c,transparent)_7%,transparent),transparent)] sm:-inset-x-6" />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-1 rounded-full font-display text-[13px] font-medium text-ink-subtle hover:text-ink">
            <ArrowLeft size={14} aria-hidden />
            Apps
          </Link>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <AppIcon app={app} size={64} className="hidden sm:inline-flex" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[26px] leading-8 font-semibold tracking-[-0.03em] text-ink min-[760px]:text-[32px] min-[760px]:leading-10" style={{ viewTransitionName: `app-${app.id}` }}>
                {app.name}
              </h1>
              {app.shortDescription ? <p className="mt-1.5 max-w-[65ch] text-[15.5px] leading-[1.65] text-ink-subtle">{app.shortDescription}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {app.area ? <Badge color={areaColor(app.area)}>{app.area}</Badge> : null}
                {!canEdit ? <Badge color={STATUS_COLORS[app.status]}>{statusLabel(app.status)}</Badge> : null}
                <Badge>{maturityLabel(app.maturity)}</Badge>
                <Badge>
                  <PriorityIcon priority={app.priority} />
                  {priorityLabel(app.priority)}
                </Badge>
                {due.length ? <Badge tone="warning">{due.length} secret(s) a rodar</Badge> : null}
                <span className="ml-1 font-mono text-[12px] text-ink-tertiary">atualizada {fmtRelative(app.updatedAt ?? null)}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <FilterChip
                  icon={<Flag size={14} />}
                  label="Estado"
                  value={app.status}
                  clearable={false}
                  align="right"
                  options={STATUSES.map((s) => ({ value: s.key, label: s.label, color: STATUS_COLORS[s.key] }))}
                  onChange={(v) => changeStatus(v as StatusKey)}
                />
              ) : null}
              <EnvUrlLinks app={app} />
              {canEdit ? (
                <Button variant="primary" onClick={() => navigate(`/apps/${app.id}/editar`)}>
                  <PencilSimple size={14} aria-hidden />
                  Editar
                </Button>
              ) : null}
              {isAdmin ? (
                <IconButton ring label="Apagar app" onClick={() => setConfirmDelete(true)} className="text-danger hover:bg-danger-soft hover:text-danger">
                  <Trash size={15} aria-hidden />
                </IconButton>
              ) : null}
            </div>
          </div>
          <div role="tablist" aria-label="Secções da app" className="scroll-x -mb-px mt-6 flex overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls={`panel-${t.key}`}
                onClick={() => setTab(t.key)}
                className={clsx(
                  'relative h-11 shrink-0 px-3 font-display text-[13.5px] font-medium transition-colors duration-150 first:pl-0',
                  tab === t.key ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-ink first:after:left-0' : 'text-ink-subtle hover:text-ink',
                )}
              >
                <span className="flex items-center gap-1.5">
                  <t.icon size={15} aria-hidden />
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="py-6">
        {tab === 'geral' ? <Overview app={app} /> : null}
        {tab === 'ambientes' ? (
          <div className="flex flex-col gap-5">
            <Segmented<EnvKey>
              label="Ambiente"
              value={env}
              onChange={setEnv}
              className="w-fit"
              options={ENVS.map((e) => ({
                value: e.key,
                title: app.environments[e.key].enabled ? e.label : `${e.label} (não existe)`,
                disabled: !app.environments[e.key].enabled,
                count: appSecrets.filter((x) => x.env === e.key).length + app.environments[e.key].variables.length,
                label: (
                  <>
                    <span className="font-mono text-[11.5px] tracking-wide">{e.short}</span>
                    <span className="hidden sm:inline">{e.label}</span>
                  </>
                ),
              }))}
            />
            <EnvPanel key={env} app={app} env={env} />
          </div>
        ) : null}
        {tab === 'pessoas' ? <People app={app} /> : null}
        {tab === 'governo' ? <Governance app={app} /> : null}
        {tab === 'historico' ? <History appId={app.id} /> : null}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Apagar ${app.name}?`}
        body="A ficha, o histórico e todos os secrets desta app são apagados de vez. Se a app só deixou de ser usada, muda o estado para Descontinuada em vez de apagar."
        confirmLabel="Apagar de vez"
        danger
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true)
          try {
            await deleteApp(app, actor)
            toast('App apagada.')
            navigate('/')
          } catch (e) {
            toast((e as Error).message, 'error')
            setDeleting(false)
          }
        }}
      />
    </div>
  )
}
