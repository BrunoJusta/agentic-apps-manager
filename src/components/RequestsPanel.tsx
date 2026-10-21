import { useEffect, useMemo, useState } from 'react'
import { ArrowsClockwise, Bug, ChatCircleText, PencilSimple, PencilSimpleLine, Plus, PuzzlePiece, Trash } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { deleteRequest, saveRequest, setRequestStatus } from '../data/store'
import { isRequestOpen, PRIORITIES, REQUEST_STATUSES, REQUEST_TYPES, requestStatusLabel, requestTypeLabel } from '../lib/constants'
import { REQUEST_STATUS_COLORS } from '../lib/colors'
import { fmtDate, fmtRelative } from '../lib/format'
import type { AgenticApp, AppRequest, Person, PriorityKey, RequestStatus, RequestType } from '../lib/types'
import { PriorityIcon } from './AppCard'
import { FilterChip } from './FiltersBar'
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, Field, IconButton, Input, Panel, PersonInput, Segmented, Select, Textarea } from './ui'

const TYPE_ICONS: Record<RequestType, typeof Bug> = {
  alteracao: PencilSimpleLine,
  update: ArrowsClockwise,
  modulo: PuzzlePiece,
  bug: Bug,
}

export function useAppRequests(appId: string) {
  const { requests } = useApps()
  return useMemo(() => requests.filter((r) => r.appId === appId), [requests, appId])
}

export function openRequestsCount(requests: AppRequest[]) {
  return requests.filter((r) => isRequestOpen(r.status)).length
}

function RequestDialog({ open, onClose, app, editing }: { open: boolean; onClose: () => void; app: AgenticApp; editing: AppRequest | null }) {
  const { actor, name, email } = useAuth()
  const toast = useToast()
  const [type, setType] = useState<RequestType>('alteracao')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<PriorityKey>('media')
  const [requestedBy, setRequestedBy] = useState<Person>({ name: '', email: '' })
  const [dueDate, setDueDate] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setType(editing?.type ?? 'alteracao')
    setTitle(editing?.title ?? '')
    setDescription(editing?.description ?? '')
    setPriority(editing?.priority ?? 'media')
    setRequestedBy(editing?.requestedBy ?? { name, email })
    setDueDate(editing?.dueDate ?? '')
    setErr(null)
  }, [open, editing, name, email])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Editar pedido' : `Novo pedido para ${app.name}`}
      description="Alterações, updates, novos módulos ou bugs pedidos para esta app."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="request-form" loading={busy}>
            {editing ? 'Guardar' : 'Registar pedido'}
          </Button>
        </>
      }
    >
      <form
        id="request-form"
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!title.trim()) {
            setErr('Dá um título ao pedido.')
            document.getElementById('rq-title')?.focus()
            return
          }
          setBusy(true)
          try {
            await saveRequest(
              { id: editing?.id, appId: app.id, type, title, description, priority, status: editing?.status ?? 'novo', requestedBy, dueDate },
              actor,
            )
            toast(editing ? 'Pedido atualizado.' : 'Pedido registado.')
            onClose()
          } catch (x) {
            setErr((x as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[12px] font-medium text-ink-subtle">Tipo</span>
          <Segmented<RequestType>
            label="Tipo de pedido"
            value={type}
            onChange={setType}
            className="w-fit"
            options={REQUEST_TYPES.map((t) => {
              const Icon = TYPE_ICONS[t.key]
              return {
                value: t.key,
                label: (
                  <>
                    <Icon size={14} aria-hidden />
                    {t.label}
                  </>
                ),
              }
            })}
          />
        </div>
        <Field label="Título" htmlFor="rq-title" error={err}>
          <Input id="rq-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Exportar pedidos para Excel" aria-invalid={!!err} autoComplete="off" />
        </Field>
        <Field label="Descrição" htmlFor="rq-desc" hint="O que se pede, porquê, e como se sabe que está feito.">
          <Textarea id="rq-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-28" />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prioridade" htmlFor="rq-prio">
            <Select id="rq-prio" value={priority} onChange={(e) => setPriority(e.target.value as PriorityKey)}>
              {PRIORITIES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data pretendida" htmlFor="rq-due">
            <Input id="rq-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Pedido por" htmlFor="rq-by">
          <PersonInput id="rq-by" value={requestedBy} onChange={setRequestedBy} />
        </Field>
      </form>
    </Dialog>
  )
}

type Filter = 'abertos' | 'fechados' | 'todos'

export function RequestsPanel({ app }: { app: AgenticApp }) {
  const { canEdit, isAdmin, actor, status } = useAuth()
  const toast = useToast()
  const all = useAppRequests(app.id)
  const [filter, setFilter] = useState<Filter>('abertos')
  const [dlg, setDlg] = useState<{ open: boolean; editing: AppRequest | null }>({ open: false, editing: null })
  const [del, setDel] = useState<AppRequest | null>(null)
  const canCreate = status === 'ready'

  const openCount = openRequestsCount(all)
  const rows = useMemo(() => {
    const rank = (r: AppRequest) => REQUEST_STATUSES.findIndex((s) => s.key === r.status)
    const prio = (r: AppRequest) => PRIORITIES.find((p) => p.key === r.priority)?.rank ?? 9
    return all
      .filter((r) => (filter === 'todos' ? true : filter === 'abertos' ? isRequestOpen(r.status) : !isRequestOpen(r.status)))
      .sort((a, b) => rank(a) - rank(b) || prio(a) - prio(b) || (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
  }, [all, filter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Filter>
          label="Filtrar pedidos"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'abertos', label: 'Abertos', count: openCount },
            { value: 'fechados', label: 'Fechados', count: all.length - openCount },
            { value: 'todos', label: 'Todos', count: all.length },
          ]}
        />
        {canCreate ? (
          <Button variant="primary" className="ml-auto" onClick={() => setDlg({ open: true, editing: null })}>
            <Plus size={14} weight="bold" aria-hidden />
            Novo pedido
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<ChatCircleText size={22} />}
            title={all.length ? 'Nada neste filtro' : 'Sem pedidos'}
            body={all.length ? undefined : 'Regista aqui alterações, updates, novos módulos ou bugs pedidos para esta app.'}
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-hairline">
            {rows.map((r) => {
              const Icon = TYPE_ICONS[r.type] ?? PencilSimpleLine
              const mine = r.createdBy === actor.email
              return (
                <li key={r.id} className="group flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:gap-4">
                  <span className="mt-0.5 hidden size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink sm:flex" aria-hidden>
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-[14.5px] font-semibold tracking-[-0.01em] text-ink">{r.title}</p>
                      <PriorityIcon priority={r.priority} />
                    </div>
                    {r.description ? <p className="mt-1 line-clamp-3 max-w-[75ch] text-[13.5px] whitespace-pre-line text-ink-subtle">{r.description}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge>{requestTypeLabel(r.type)}</Badge>
                      {!canEdit ? <Badge color={REQUEST_STATUS_COLORS[r.status]}>{requestStatusLabel(r.status)}</Badge> : null}
                      <span className="font-mono text-[11.5px] text-ink-tertiary">
                        {r.requestedBy?.name ? `${r.requestedBy.name}, ` : ''}
                        {fmtRelative(r.createdAt ?? null)}
                        {r.dueDate ? `, para ${fmtDate(r.dueDate)}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canEdit ? (
                      <FilterChip
                        icon={<span className="dot" style={{ ['--c' as string]: REQUEST_STATUS_COLORS[r.status] }} />}
                        label="Estado"
                        value={r.status}
                        clearable={false}
                        align="right"
                        options={REQUEST_STATUSES.map((s) => ({ value: s.key, label: s.label, color: REQUEST_STATUS_COLORS[s.key] }))}
                        onChange={async (v) => {
                          try {
                            await setRequestStatus(r, v as RequestStatus, requestStatusLabel(v as RequestStatus), actor)
                          } catch (x) {
                            toast((x as Error).message, 'error')
                          }
                        }}
                      />
                    ) : null}
                    {canEdit || mine ? (
                      <IconButton label={`Editar ${r.title}`} onClick={() => setDlg({ open: true, editing: r })}>
                        <PencilSimple size={15} aria-hidden />
                      </IconButton>
                    ) : null}
                    {canEdit || isAdmin ? (
                      <IconButton label={`Apagar ${r.title}`} onClick={() => setDel(r)} className="hover:text-danger">
                        <Trash size={15} aria-hidden />
                      </IconButton>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}

      <RequestDialog open={dlg.open} editing={dlg.editing} app={app} onClose={() => setDlg({ open: false, editing: null })} />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        title={`Apagar o pedido “${del?.title}”?`}
        body="Se o pedido foi só recusado, muda o estado para Rejeitado em vez de apagar, para ficar o registo."
        confirmLabel="Apagar pedido"
        danger
        onConfirm={async () => {
          if (!del) return
          await deleteRequest(del, actor)
          setDel(null)
          toast('Pedido apagado.')
        }}
      />
    </div>
  )
}
