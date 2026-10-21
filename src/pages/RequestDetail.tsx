import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PencilSimple, Trash } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { deleteRequest, setRequestStatus } from '../data/store'
import { priorityLabel, REQUEST_STATUSES, requestStatusLabel, requestTypeLabel } from '../lib/constants'
import { areaColor, entityStyle, REQUEST_STATUS_COLORS } from '../lib/colors'
import { fmtDate, fmtDateTime, fmtRelative } from '../lib/format'
import type { RequestStatus } from '../lib/types'
import { AppIcon, PriorityIcon } from '../components/AppCard'
import { FilterChip } from '../components/FiltersBar'
import { RequestDialog, TYPE_ICONS } from '../components/RequestsPanel'
import { Badge, Button, ConfirmDialog, EmptyState, IconButton, Panel } from '../components/ui'

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-ink-subtle">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children || <span className="text-ink-tertiary">Por definir</span>}</dd>
    </div>
  )
}

/** Mostra a descrição respeitando as linhas; linhas só em maiúsculas viram subtítulos. */
function Description({ text }: { text: string }) {
  const blocks = useMemo(() => {
    const out: { heading?: string; body: string[] }[] = [{ body: [] }]
    for (const line of text.split('\n')) {
      const t = line.trim()
      const isHeading = t.length > 3 && /[A-ZÀ-Ý]/.test(t) && t === t.toUpperCase() && !/^[-*•\d]/.test(t)
      if (isHeading) out.push({ heading: t, body: [] })
      else out[out.length - 1].body.push(line)
    }
    return out.map((b) => ({ ...b, body: b.body.join('\n').replace(/^\n+|\n+$/g, '') })).filter((b) => b.heading || b.body)
  }, [text])

  return (
    <div className="flex flex-col gap-5">
      {blocks.map((b, i) => (
        <section key={i}>
          {b.heading ? <h3 className="mb-2 font-display text-[13px] font-semibold tracking-[0.04em] text-ink-subtle uppercase">{b.heading}</h3> : null}
          {b.body ? <p className="max-w-[80ch] text-[14.5px] leading-[1.7] whitespace-pre-wrap text-ink">{b.body}</p> : null}
        </section>
      ))}
    </div>
  )
}

export function RequestDetailPage() {
  const { id, reqId } = useParams()
  const { byId, requests, loading } = useApps()
  const { canEdit, isAdmin, actor } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const app = id ? byId(id) : undefined
  const r = requests.find((x) => x.id === reqId && x.appId === id)
  const back = `/apps/${id}?tab=pedidos`

  if (loading) return <p className="py-16 text-center text-sm text-ink-subtle">A carregar…</p>
  if (!app || !r)
    return (
      <div className="py-16">
        <EmptyState
          title="Este pedido não existe ou foi apagado."
          action={
            <Link to={app ? back : '/'} className="text-sm text-accent-text underline underline-offset-2">
              {app ? `Voltar aos pedidos de ${app.name}` : 'Voltar ao board'}
            </Link>
          }
        />
      </div>
    )

  const Icon = TYPE_ICONS[r.type]
  const mine = r.createdBy === actor.email

  return (
    <div className="enter pb-16" style={entityStyle(areaColor(app.area))}>
      <div className="border-b border-hairline pt-8 pb-6">
        <Link to={back} className="inline-flex items-center gap-1.5 rounded-full font-display text-[13px] font-medium text-ink-subtle hover:text-ink">
          <ArrowLeft size={14} aria-hidden />
          <AppIcon app={app} size={18} />
          {app.name}, pedidos
        </Link>
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
            <Icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[24px] leading-8 font-semibold tracking-[-0.03em] text-balance text-ink min-[760px]:text-[28px] min-[760px]:leading-9">{r.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge>{requestTypeLabel(r.type)}</Badge>
              {!canEdit ? <Badge color={REQUEST_STATUS_COLORS[r.status]}>{requestStatusLabel(r.status)}</Badge> : null}
              <Badge>
                <PriorityIcon priority={r.priority} />
                Prioridade {priorityLabel(r.priority).toLowerCase()}
              </Badge>
              <span className="font-mono text-[11.5px] text-ink-tertiary">registado {fmtRelative(r.createdAt ?? null)}</span>
            </div>
          </div>
          <div className="flex basis-full items-center gap-1.5 pl-14 md:basis-auto md:shrink-0 md:pl-0">
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
                    toast(`Estado alterado para ${requestStatusLabel(v as RequestStatus)}.`)
                  } catch (x) {
                    toast((x as Error).message, 'error')
                  }
                }}
              />
            ) : null}
            {canEdit || mine ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <PencilSimple size={15} aria-hidden />
                Editar
              </Button>
            ) : null}
            {canEdit || isAdmin ? (
              <IconButton label="Apagar pedido" onClick={() => setDelOpen(true)} className="hover:text-danger">
                <Trash size={16} aria-hidden />
              </IconButton>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="p-6 sm:p-7">
          {r.description ? <Description text={r.description} /> : <p className="text-sm text-ink-tertiary">Sem descrição.</p>}
        </Panel>
        <div className="flex flex-col gap-5 lg:sticky lg:top-[84px] lg:self-start">
          <Panel className="px-5 py-2">
            <dl className="divide-y divide-hairline">
              <Fact label="Estado">
                <span className="inline-flex items-center gap-1.5">
                  <span className="dot" style={{ ['--c' as string]: REQUEST_STATUS_COLORS[r.status] }} />
                  {requestStatusLabel(r.status)}
                </span>
              </Fact>
              <Fact label="Tipo">{requestTypeLabel(r.type)}</Fact>
              <Fact label="Prioridade">{priorityLabel(r.priority)}</Fact>
              <Fact label="Data pretendida">{r.dueDate ? fmtDate(r.dueDate) : ''}</Fact>
              <Fact label="Pedido por">
                {r.requestedBy?.name ? (
                  <span className="flex flex-col items-end">
                    <span>{r.requestedBy.name}</span>
                    {r.requestedBy.email ? <a href={`mailto:${r.requestedBy.email}`} className="text-[12px] text-ink-subtle hover:text-ink hover:underline">{r.requestedBy.email}</a> : null}
                  </span>
                ) : (
                  ''
                )}
              </Fact>
            </dl>
          </Panel>
          <Panel className="px-5 py-2">
            <dl className="divide-y divide-hairline">
              <Fact label="Registado por">
                <span className="flex flex-col items-end">
                  <span className="truncate">{r.createdBy}</span>
                  <span className="text-[12px] text-ink-subtle">{fmtDateTime(r.createdAt ?? null)}</span>
                </span>
              </Fact>
              {r.updatedBy ? (
                <Fact label="Última alteração">
                  <span className="flex flex-col items-end">
                    <span className="truncate">{r.updatedBy}</span>
                    <span className="text-[12px] text-ink-subtle">{fmtDateTime(r.updatedAt ?? null)}</span>
                  </span>
                </Fact>
              ) : null}
            </dl>
          </Panel>
        </div>
      </div>

      <RequestDialog open={editOpen} editing={r} app={app} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title={`Apagar o pedido “${r.title}”?`}
        body="Se o pedido foi só recusado, muda o estado para Rejeitado em vez de apagar, para ficar o registo."
        confirmLabel="Apagar pedido"
        danger
        onConfirm={async () => {
          await deleteRequest(r, actor)
          setDelOpen(false)
          toast('Pedido apagado.')
          navigate(back)
        }}
      />
    </div>
  )
}
