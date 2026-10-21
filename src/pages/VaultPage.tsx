import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ClockCountdown, HardDrives, Key, MagnifyingGlass } from '@phosphor-icons/react'
import { FilterChip } from '../components/FiltersBar'
import { useApps } from '../context/AppsContext'
import { useVault } from '../context/VaultContext'
import { daysUntil } from '../lib/app-utils'
import { ROTATION_WARNING_DAYS, secretTypeLabel } from '../lib/constants'
import { fmtDate } from '../lib/format'
import { PageHeader } from '../components/Layout'
import { VaultStatusCard } from '../components/VaultGate'
import { Badge, EmptyState, Input, Panel } from '../components/ui'

export function VaultPage() {
  const vault = useVault()
  const { apps } = useApps()
  const [q, setQ] = useState('')
  const [env, setEnv] = useState('')
  const names = useMemo(() => new Map(apps.map((a) => [a.id, a.name])), [apps])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return vault.secrets
      .filter((x) => (!env || x.env === env) && (!s || x.name.toLowerCase().includes(s) || (names.get(x.appId) ?? '').toLowerCase().includes(s) || x.note.toLowerCase().includes(s)))
      .sort((a, b) => (names.get(a.appId) ?? '').localeCompare(names.get(b.appId) ?? '', 'pt') || a.env.localeCompare(b.env) || a.name.localeCompare(b.name))
  }, [vault.secrets, q, env, names])

  const due = useMemo(
    () =>
      vault.secrets
        .map((s) => ({ s, d: daysUntil(s.rotateBy) }))
        .filter((x): x is { s: typeof x.s; d: number } => x.d !== null && x.d <= ROTATION_WARNING_DAYS)
        .sort((a, b) => a.d - b.d),
    [vault.secrets],
  )

  return (
    <>
      <PageHeader title="Cofre" description="Secrets de todas as apps, cifrados no browser com AES-256-GCM. Aqui procuras pelo nome, pela app ou pela nota; os valores revelam-se na ficha de cada app." />
      <div className="flex flex-col gap-6">
        <VaultStatusCard />

        {vault.status !== 'unavailable' ? (
          <>
            {due.length ? (
              <Panel className="p-5">
                <div className="flex items-center gap-2">
                  <ClockCountdown size={18} className="text-warning" aria-hidden />
                  <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">A precisar de rotação</h2>
                  <span className="count">{due.length}</span>
                </div>
                <ul className="mt-3 flex flex-col gap-1">
                  {due.map(({ s, d }) => (
                    <li key={s.id}>
                      <Link to={`/apps/${s.appId}?tab=ambientes&env=${s.env}#secret-${s.id}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-2">
                        <span className="font-mono text-[13px] text-ink">{s.name}</span>
                        <span className="min-w-0 flex-1 truncate text-ink-subtle">
                          {names.get(s.appId)} ({s.env.toUpperCase()})
                        </span>
                        <Badge tone={d < 0 ? 'danger' : 'warning'}>{d < 0 ? `Expirou há ${-d} d` : d === 0 ? 'Hoje' : `${d} d`}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            <section aria-labelledby="all-secrets">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="all-secrets" className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">
                  Todos os secrets
                </h2>
                <span className="count">{vault.secrets.length}</span>
                <div className="ml-auto flex w-full gap-2 sm:w-auto">
                  <div className="relative flex-1 sm:w-72">
                    <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-tertiary" aria-hidden />
                    <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, app ou nota" aria-label="Procurar secrets" className="h-8 pl-8 text-[13px]" spellCheck={false} />
                  </div>
                  <FilterChip icon={<HardDrives size={14} />} label="Ambiente" value={env} allLabel="Todos" align="right" options={[{ value: 'dev', label: 'DEV' }, { value: 'qa', label: 'QA' }, { value: 'prod', label: 'PROD' }]} onChange={setEnv} />
                </div>
              </div>
              <Panel className="mt-3 overflow-hidden">
                {!vault.secretsLoaded ? (
                  <p className="px-4 py-6 text-sm text-ink-subtle">A carregar…</p>
                ) : rows.length === 0 ? (
                  <EmptyState icon={<Key size={36} weight="thin" />} title={vault.secrets.length ? 'Nada encontrado' : 'Ainda não há secrets'} body={vault.secrets.length ? undefined : 'Os secrets criam-se na ficha de cada app, separador Ambientes e cofre.'} />
                ) : (
                  <ul className="divide-y divide-hairline">
                    {rows.map((s) => {
                      const d = daysUntil(s.rotateBy)
                      return (
                        <li key={s.id}>
                          <Link to={`/apps/${s.appId}?tab=ambientes&env=${s.env}#secret-${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 transition-colors hover:bg-surface-2">
                            <span className="flex min-w-0 items-center gap-2 sm:w-72">
                              <Key size={14} className="shrink-0 text-accent-text" aria-hidden />
                              <span className="truncate font-mono text-[13px] text-ink">{s.name}</span>
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">{names.get(s.appId) ?? 'App apagada'}</span>
                            <span className={clsx('tg mn', s.env === 'prod' && 'bg-ink text-canvas')}>{s.env.toUpperCase()}</span>
                            <span className="hidden w-36 text-[12px] text-ink-subtle md:block">{secretTypeLabel(s.type)}</span>
                            <span className="w-28 text-right text-[12px] text-ink-subtle tabular">{s.rotateBy ? <span className={d !== null && d <= ROTATION_WARNING_DAYS ? 'text-warning' : ''}>{fmtDate(s.rotateBy)}</span> : 'Sem rotação'}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>
            </section>
          </>
        ) : null}
      </div>
    </>
  )
}
