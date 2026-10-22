import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowUp, CaretDoubleUp, ChatCircleText, ClockCountdown, GithubLogo, Sparkle } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import type { AgenticApp } from '../lib/types'
import { allTags, daysUntil } from '../lib/app-utils'
import { ENVS, isRequestOpen, maturityLabel, priorityLabel, ROTATION_WARNING_DAYS, statusLabel } from '../lib/constants'
import { areaColor, entityStyle, STATUS_COLORS } from '../lib/colors'
import { trackSpotlight } from '../lib/spotlight'
import { Badge } from './ui'

export function rotationDue<T extends { rotateBy: string }>(secrets: T[]) {
  return secrets.filter((s) => {
    const d = daysUntil(s.rotateBy)
    return d !== null && d <= ROTATION_WARNING_DAYS
  })
}

export function PriorityIcon({ priority }: { priority: AgenticApp['priority'] }) {
  if (priority === 'critica') return <CaretDoubleUp size={14} weight="bold" className="shrink-0 text-danger" aria-label={`Prioridade ${priorityLabel(priority)}`} />
  if (priority === 'alta') return <ArrowUp size={14} weight="bold" className="shrink-0 text-warning" aria-label={`Prioridade ${priorityLabel(priority)}`} />
  return null
}

/** Ícone da app: sempre quadrado 1:1. Sem imagem, mostra as iniciais na cor da área. */
export function AppIcon({ app, size = 36, className }: { app: Pick<AgenticApp, 'name' | 'icon' | 'area'>; size?: number; className?: string }) {
  const radius = Math.round(size * 0.24)
  if (app.icon) {
    return <img src={app.icon} alt="" width={size} height={size} className={clsx('shrink-0 object-cover shadow-ring', className)} style={{ width: size, height: size, borderRadius: radius }} />
  }
  const initials = (app.name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  const c = areaColor(app.area)
  return (
    <span
      aria-hidden
      className={clsx('inline-flex shrink-0 items-center justify-center font-display font-semibold shadow-ring', className)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: Math.round(size * 0.36),
        background: c ? `color-mix(in srgb, ${c} 14%, var(--surface-1))` : 'var(--surface-2)',
        color: c ? `color-mix(in srgb, ${c} 80%, var(--ink))` : 'var(--ink-muted)',
      }}
    >
      {initials}
    </span>
  )
}

/** Cor da entidade de um cartão: a área (cadeia de valor). */
export const appColor = (app: AgenticApp) => areaColor(app.area)

export function AppCardBody({ app, secrets, showStatus }: { app: AgenticApp; secrets: { rotateBy: string }[]; showStatus?: boolean }) {
  const tags = allTags(app)
  const due = rotationDue(secrets)
  const { requests } = useApps()
  const openReq = requests.filter((r) => r.appId === app.id && isRequestOpen(r.status)).length
  return (
    <>
      <div className="cbody">
        <div className="flex items-start gap-3">
          <AppIcon app={app} size={32} />
          <h3 className="min-w-0 flex-1 self-center text-ink">{app.name || 'Sem nome'}</h3>
          <span className="mt-1">
            <PriorityIcon priority={app.priority} />
          </span>
        </div>
        {app.shortDescription ? <p className="-mt-1 line-clamp-2 text-[13.5px] leading-snug text-ink-subtle">{app.shortDescription}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {app.area ? <Badge color={appColor(app)}>{app.area}</Badge> : null}
          {showStatus ? <Badge color={STATUS_COLORS[app.status]}>{statusLabel(app.status)}</Badge> : <Badge>{maturityLabel(app.maturity)}</Badge>}
          {tags.slice(0, app.area ? 1 : 2).map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
          {tags.length > (app.area ? 1 : 2) ? (
            <Badge mono title={tags.slice(app.area ? 1 : 2).join(', ')}>
              +{tags.length - (app.area ? 1 : 2)}
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="cfoot text-[12px] text-ink-tertiary">
        <span className="flex items-center gap-1.5" aria-label="Ambientes ativos">
          {ENVS.map((e) => (
            <span
              key={e.key}
              className={clsx('font-mono text-[11px] tracking-wide', app.environments[e.key].enabled ? 'text-ink-muted' : 'text-ink-tertiary/60 line-through decoration-1')}
              title={`${e.label}: ${app.environments[e.key].enabled ? 'ativo' : 'não existe'}`}
            >
              {e.short}
            </span>
          ))}
        </span>
        {app.repo.account ? (
          <span className="flex items-center gap-1" title={app.repo.account === 'sogrape' ? 'Repositório na organização Sogrape' : app.repo.account === 'ai_studio' ? 'Código no Google AI Studio' : 'Repositório em conta pessoal'}>
            {app.repo.account === 'ai_studio' ? <Sparkle size={12} aria-hidden /> : <GithubLogo size={12} aria-hidden />}
            {app.repo.account === 'sogrape' ? 'Sogrape' : app.repo.account === 'ai_studio' ? 'AI Studio' : 'Pessoal'}
          </span>
        ) : null}
        {openReq ? (
          <span className="flex items-center gap-1 font-mono" title={`${openReq} pedido(s) em aberto`}>
            <ChatCircleText size={12} aria-hidden />
            {openReq}
          </span>
        ) : null}
        {due.length ? (
          <span className="ml-auto flex items-center gap-1 font-mono text-warning" title={`${due.length} secret(s) a precisar de rotação`}>
            <ClockCountdown size={12} weight="bold" aria-hidden />
            {due.length}
          </span>
        ) : null}
      </div>
    </>
  )
}

export function AppCardLink({ app, secrets, index = 0, showStatus }: { app: AgenticApp; secrets: { rotateBy: string }[]; index?: number; showStatus?: boolean }) {
  return (
    <Link
      to={`/apps/${app.id}`}
      onPointerMove={trackSpotlight}
      style={entityStyle(appColor(app), { ['--i' as string]: index, viewTransitionName: `app-${app.id}` })}
      className="card spotlight stagger focus-visible:outline-offset-2"
    >
      <AppCardBody app={app} secrets={secrets} showStatus={showStatus} />
    </Link>
  )
}
