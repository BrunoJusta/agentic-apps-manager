import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { DownloadSimple, Kanban, Plus, RocketLaunch, Rows, UploadSimple, CheckCircle, XCircle } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { useAuth } from '../context/AuthContext'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { applyFilters, useFilters, type ViewMode } from '../lib/filters'
import { productionReadiness, sortForBoard, toInput } from '../lib/app-utils'
import { isFinished, MATURITIES, REPO_ACCOUNTS, STATUSES, statusLabel } from '../lib/constants'
import { moveApp } from '../data/store'
import type { AgenticApp, MaturityKey, SecretDoc, StatusKey } from '../lib/types'
import { PageHeader } from '../components/Layout'
import { FiltersBar, GroupByChip } from '../components/FiltersBar'
import { AppCardBody, AppCardLink, appColor } from '../components/AppCard'
import { areaColor, entityStyle, STATUS_COLORS } from '../lib/colors'
import { ImportJsonDialog } from '../components/ImportJsonDialog'
import { Button, Dialog, Dot, EmptyState, IconButton, Segmented, Skeleton } from '../components/ui'
import { AppsTable } from '../components/AppsTable'
import { trackSpotlight } from '../lib/spotlight'

interface Column {
  key: string
  label: string
  hint?: string
  color?: string
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Corre a mudança dentro de uma View Transition (quando o browser suporta). */
function withTransition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  if (d.startViewTransition && !reducedMotion()) d.startViewTransition(() => flushSync(fn))
  else fn()
}

function DraggableCard({ app, secrets, index, disabled, animate }: { app: AgenticApp; secrets: SecretDoc[]; index: number; disabled: boolean; animate: boolean }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: app.id, disabled })
  // tiramos o role="button" do dnd-kit para o cartão continuar a ser um link
  const { role: _role, ...attrs } = attributes
  return (
    <div ref={setNodeRef} {...attrs} {...listeners} aria-roledescription={disabled ? undefined : 'cartão arrastável'} className={clsx('outline-none', isDragging && 'opacity-30')}>
      <AppCardLink app={app} secrets={secrets} index={animate ? index : 0} />
    </div>
  )
}

/** Zona para largar uma app e passá-la a Produção (sai do board para Finalizadas). */
function ProductionDropZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'producao' })
  return (
    <section aria-label="Passar a Produção" className="flex w-44 shrink-0 flex-col">
      <header className="flex h-10 items-center gap-2 px-1.5">
        <Dot color={STATUS_COLORS.producao} />
        <h2 className="font-display text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap text-ink">Produção</h2>
      </header>
      <div
        ref={setNodeRef}
        className={clsx(
          'flex min-h-36 flex-1 flex-col items-center justify-center gap-2 rounded-card p-4 text-center transition-[background-color,box-shadow] duration-200',
          isOver ? 'drop-glow' : active ? 'bg-sel shadow-[inset_0_0_0_1px_var(--hairline-strong)]' : 'shadow-[inset_0_0_0_1px_var(--hairline)]',
        )}
      >
        <RocketLaunch size={20} className={isOver ? 'text-ink' : 'text-ink-tertiary'} aria-hidden />
        <p className="text-[12px] text-ink-subtle">{active ? 'Larga aqui para passar a Produção' : 'Arrasta uma app para aqui quando entrar em produção'}</p>
        <Link to="/finalizadas" className="font-display text-[12px] font-medium text-ink-subtle underline decoration-hairline-strong underline-offset-2 hover:text-ink">
          Ver em Finalizadas
        </Link>
      </div>
    </section>
  )
}

function DroppableColumn({ col, count, droppable, children, onAdd }: { col: Column; count: number; droppable: boolean; children: React.ReactNode; onAdd?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key, disabled: !droppable })
  return (
    <section aria-label={`${col.label}, ${count} apps`} className="flex min-w-[200px] flex-1 basis-0 flex-col">
      <header className="flex h-10 items-center gap-2 px-1.5">
        {col.color ? <Dot color={col.color} /> : null}
        <h2 className="min-w-0 truncate font-display text-[13.5px] font-semibold tracking-[-0.01em] whitespace-nowrap text-ink" title={col.hint ?? col.label}>
          {col.label}
        </h2>
        <span className="rounded-full bg-surface-3 px-1.5 py-px font-mono text-[11px] text-ink-subtle tabular">{count}</span>
        {onAdd ? (
          <IconButton label={`Nova app em ${col.label}`} onClick={onAdd} className="ml-auto">
            <Plus size={14} aria-hidden />
          </IconButton>
        ) : null}
      </header>
      <div
        ref={setNodeRef}
        className={clsx('flex min-h-36 flex-1 flex-col gap-2.5 rounded-card bg-sel p-2 transition-[background-color,box-shadow] duration-200', isOver && droppable && 'drop-glow')}
      >
        {children}
      </div>
    </section>
  )
}

export function AppsPage() {
  const { apps, loading, error } = useApps()
  const { canEdit, email, actor } = useAuth()
  const { secrets } = useVault()
  const { filters, set, active: filtering, clear } = useFilters()
  const toast = useToast()
  const navigate = useNavigate()
  const [override, setOverride] = useState<Record<string, string>>({})
  const [dragging, setDragging] = useState<AgenticApp | null>(null)
  const [gate, setGate] = useState<{ app: AgenticApp; missing: string[] } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [animate, setAnimate] = useState(true)
  const firstPaint = useRef(true)

  useEffect(() => {
    if (!loading && firstPaint.current) {
      firstPaint.current = false
      const t = window.setTimeout(() => setAnimate(false), 900)
      return () => window.clearTimeout(t)
    }
  }, [loading])

  const group = filters.group
  const field: 'status' | 'maturity' | null = group === 'status' ? 'status' : group === 'maturity' ? 'maturity' : null

  // Limpa overrides otimistas quando o Firestore já reflete a mudança.
  useEffect(() => {
    setOverride((o) => {
      const next = { ...o }
      let changed = false
      for (const [id, v] of Object.entries(o)) {
        const a = apps.find((x) => x.id === id)
        if (!a || (field && a[field] === v)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : o
    })
  }, [apps, field])

  const secretsByApp = useMemo(() => {
    const m = new Map<string, SecretDoc[]>()
    for (const s of secrets) m.set(s.appId, [...(m.get(s.appId) ?? []), s])
    return m
  }, [secrets])

  // O board só mostra apps em curso; Produção e Descontinuada vivem na tab Finalizadas.
  const activeApps = useMemo(() => apps.filter((a) => !isFinished(a.status)), [apps])
  const finishedCount = apps.length - activeApps.length

  const visible = useMemo(() => {
    const withOverride = activeApps.map((a) => (override[a.id] && field ? { ...a, [field]: override[a.id] } : a))
    return applyFilters(withOverride, filters, email).sort(sortForBoard)
  }, [activeApps, override, field, filters, email])

  const columns: Column[] = useMemo(() => {
    if (group === 'maturity') return MATURITIES.map((m) => ({ key: m.key, label: m.label }))
    if (group === 'account') return [...REPO_ACCOUNTS.map((r) => ({ key: r.key, label: r.label })), { key: '', label: 'Sem conta definida' }]
    if (group === 'area') {
      const areas = [...new Set(activeApps.map((a) => a.area.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'))
      return [...areas.map((a) => ({ key: a, label: a, color: areaColor(a) })), { key: '', label: 'Sem área' }]
    }
    return STATUSES.filter((s) => !isFinished(s.key)).map((s) => ({ key: s.key, label: s.label, hint: s.hint, color: STATUS_COLORS[s.key] }))
  }, [group, activeApps])

  const keyOf = (a: AgenticApp) => (group === 'maturity' ? a.maturity : group === 'account' ? a.repo.account : group === 'area' ? a.area.trim() : a.status)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  const commitMove = async (app: AgenticApp, value: string) => {
    if (!field) return
    withTransition(() => setOverride((o) => ({ ...o, [app.id]: value })))
    try {
      await moveApp(app, field, value as StatusKey | MaturityKey, actor)
      if (field === 'status' && isFinished(value as StatusKey)) toast(`${app.name} passou a ${statusLabel(value as StatusKey)} e está agora em Finalizadas.`)
    } catch (e) {
      withTransition(() =>
        setOverride((o) => {
          const n = { ...o }
          delete n[app.id]
          return n
        }),
      )
      toast(`Não foi possível mover: ${(e as Error).message}`, 'error')
    }
  }

  const onDragStart = (e: DragStartEvent) => setDragging(apps.find((a) => a.id === e.active.id) ?? null)
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null)
    const app = apps.find((a) => a.id === e.active.id)
    const target = e.over?.id as string | undefined
    if (!app || target === undefined || !field || app[field] === target) return
    if (field === 'status' && target === 'producao') {
      const r = productionReadiness(app)
      if (!r.ready) {
        setGate({ app, missing: r.missing })
        return
      }
    }
    commitMove(app, target)
  }

  const exportJson = () => {
    const data = JSON.stringify({ exportedAt: new Date().toISOString(), apps: apps.map((a) => ({ id: a.id, ...toInput(a) })) }, null, 2)
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `agentic-apps-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const header = (
    <PageHeader
      title="Apps"
      description={
        loading ? undefined : (
          <>
            {activeApps.length} {activeApps.length === 1 ? 'app em curso' : 'apps em curso'}
            {filtering ? `, ${visible.length} com os filtros atuais` : ''}.
            {finishedCount ? (
              <>
                {' '}
                <Link to="/finalizadas" className="underline decoration-hairline-strong underline-offset-2 hover:text-ink hover:decoration-ink">
                  {finishedCount} {finishedCount === 1 ? 'finalizada' : 'finalizadas'}
                </Link>
                .
              </>
            ) : null}
          </>
        )
      }
      actions={
        <>
          {canEdit ? (
            <Button variant="secondary" onClick={() => setImportOpen(true)} className="hidden sm:inline-flex">
              <UploadSimple size={14} aria-hidden />
              Importar
            </Button>
          ) : null}
          <Button variant="secondary" onClick={exportJson} disabled={!apps.length} className="hidden sm:inline-flex">
            <DownloadSimple size={14} aria-hidden />
            Exportar
          </Button>
          {canEdit ? (
            <Button variant="primary" onClick={() => navigate("/apps/nova")}>
              <Plus size={14} weight="bold" aria-hidden />
              Nova app
            </Button>
          ) : null}
        </>
      }
    >
      <FiltersBar
        trailing={
          <div className="flex items-center gap-2">
            {filters.view === 'kanban' ? <GroupByChip /> : null}
            <Segmented<ViewMode>
              label="Vista"
              value={filters.view}
              onChange={(v) => set({ view: v })}
              options={[
                { value: 'kanban', title: 'Kanban', label: (<><Kanban size={14} aria-hidden /><span className="hidden lg:inline">Kanban</span></>) },
                { value: 'tabela', title: 'Tabela', label: (<><Rows size={14} aria-hidden /><span className="hidden lg:inline">Tabela</span></>) },
              ]}
            />
          </div>
        }
      />
    </PageHeader>
  )

  if (error) {
    return (
      <>
        {header}
        <EmptyState title="Não foi possível carregar as apps" body={error} />
      </>
    )
  }

  return (
    <>
      {header}
      {loading ? (
        <div className="flex gap-3 overflow-hidden py-1" aria-label="A carregar o board" role="status">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex min-w-[200px] flex-1 basis-0 flex-col gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-32" />
              <Skeleton className="h-28" />
            </div>
          ))}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={<Kanban size={40} weight="thin" />}
          title="Ainda não há apps no board"
          body="Cria a primeira ficha, ou importa várias de uma vez a partir de um JSON."
          action={
            canEdit ? (
              <div className="flex gap-2">
                <Button onClick={() => setImportOpen(true)}>
                  <UploadSimple size={14} aria-hidden />
                  Importar JSON
                </Button>
                <Button variant="primary" onClick={() => navigate('/apps/nova')}>
                  <Plus size={14} weight="bold" aria-hidden />
                  Nova app
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : filters.view === 'tabela' ? (
        <div className="pb-10">
          <AppsTable apps={visible} empty={<EmptyState title="Nenhuma app corresponde aos filtros" action={<Button onClick={clear}>Limpar filtros</Button>} />} />
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
          <div className="scroll-x -mx-1 flex gap-3 overflow-x-auto px-1 pt-1 pb-10">
            {columns.map((col) => {
              const items = visible.filter((a) => keyOf(a) === col.key)
              return (
                <DroppableColumn
                  key={col.key || 'none'}
                  col={col}
                  count={items.length}
                  droppable={!!field && canEdit}
                  onAdd={canEdit && group === 'status' && col.key !== 'producao' ? () => navigate(`/apps/nova?estado=${col.key}`) : undefined}
                >
                  {items.map((a, i) => (
                    <DraggableCard key={a.id} app={a} secrets={secretsByApp.get(a.id) ?? []} index={i} disabled={!field || !canEdit} animate={animate} />
                  ))}
                  {items.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[12px] text-ink-tertiary">{filtering ? 'Nada com estes filtros' : field && canEdit ? 'Arrasta uma app para aqui' : 'Vazio'}</p>
                  ) : null}
                </DroppableColumn>
              )
            })}
            {group === 'status' && canEdit ? <ProductionDropZone active={!!dragging} /> : null}
          </div>
          <DragOverlay dropAnimation={null}>
            {dragging ? (
              <div onPointerMove={trackSpotlight} style={entityStyle(appColor(dragging))} className="card drag-lift spotlight cursor-grabbing">
                <AppCardBody app={dragging} secrets={secretsByApp.get(dragging.id) ?? []} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {filtering && !loading && apps.length > 0 && visible.length === 0 && filters.view === 'kanban' ? (
        <div>
          <EmptyState title="Nenhuma app corresponde aos filtros" action={<Button onClick={clear}>Limpar filtros</Button>} />
        </div>
      ) : null}

      <ImportJsonDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <Dialog
        open={!!gate}
        onClose={() => setGate(null)}
        title={`${gate?.app.name ?? ''} ainda não está pronta para Produção`}
        description="Para passar para Produção, a ficha tem de ter o owner, o repositório e o ambiente de produção preenchidos."
        footer={
          <>
            <Button variant="ghost" onClick={() => setGate(null)}>
              Fechar
            </Button>
            <Button variant="primary" onClick={() => gate && navigate(`/apps/${gate.app.id}/editar`)}>
              Completar a ficha
            </Button>
          </>
        }
      >
        {gate ? (
          <ul className="flex flex-col gap-2">
            {productionReadiness(gate.app).items.map((it) => (
              <li key={it.label} className="flex items-center gap-2 text-sm">
                {it.ok ? <CheckCircle size={16} weight="fill" className="text-success" aria-label="Feito" /> : <XCircle size={16} weight="fill" className="text-danger" aria-label="Em falta" />}
                <span className={it.ok ? 'text-ink-subtle' : 'text-ink'}>{it.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {gate ? (
          <p className="mt-4 text-xs text-ink-subtle">
            Estado atual: {statusLabel(gate.app.status)}. <Link to={`/apps/${gate.app.id}`} className="underline underline-offset-2">Ver ficha</Link>
          </p>
        ) : null}
      </Dialog>
    </>
  )
}
