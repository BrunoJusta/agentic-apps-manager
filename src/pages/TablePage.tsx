import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { CaretDown, CaretUp, Plus, Table } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { useAuth } from '../context/AuthContext'
import { applyFilters, useFilters } from '../lib/filters'
import { ENVS, maturityLabel, priorityLabel, repoAccountLabel, STATUSES, statusLabel } from '../lib/constants'
import { priorityRank } from '../lib/app-utils'
import { fmtDate, fmtNumber, fmtRelative, toDate } from '../lib/format'
import type { AgenticApp } from '../lib/types'
import { PageHeader } from '../components/Layout'
import { FiltersBar } from '../components/FiltersBar'
import { PriorityIcon } from '../components/AppCard'
import { Badge, Button, Dot, EmptyState, Skeleton } from '../components/ui'
import { STATUS_COLORS } from '../lib/colors'

type SortKey = 'name' | 'status' | 'maturity' | 'priority' | 'owner' | 'goLive' | 'users' | 'updated'

const statusRank = (a: AgenticApp) => STATUSES.findIndex((s) => s.key === a.status)
const maturityRank = (a: AgenticApp) => ['poc', 'piloto', 'mvp', 'estavel', 'escala'].indexOf(a.maturity)

const getters: Record<SortKey, (a: AgenticApp) => string | number> = {
  name: (a) => a.name.toLowerCase(),
  status: statusRank,
  maturity: maturityRank,
  priority: (a) => priorityRank(a.priority),
  owner: (a) => a.businessOwner.name.toLowerCase(),
  goLive: (a) => a.goLiveDate || '9999',
  users: (a) => a.activeUsers ?? -1,
  updated: (a) => toDate(a.updatedAt ?? null)?.getTime() ?? 0,
}

type SortState = { key: SortKey; dir: 1 | -1 }

function Th({ k, sort, setSort, children, className }: { k: SortKey; sort: SortState; setSort: (fn: (s: SortState) => SortState) => void; children: React.ReactNode; className?: string }) {
  const active = sort.key === k
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={clsx('px-3.5 py-2.5 text-left font-medium', className)}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}
        className={clsx('inline-flex items-center gap-1 rounded font-display font-medium hover:text-ink', active ? 'text-ink' : 'text-ink-subtle')}
      >
        {children}
        {active ? sort.dir === 1 ? <CaretUp size={10} weight="bold" aria-hidden /> : <CaretDown size={10} weight="bold" aria-hidden /> : null}
      </button>
    </th>
  )
}

export function TablePage() {
  const { apps, loading } = useApps()
  const { email, canEdit } = useAuth()
  const { filters } = useFilters()
  const navigate = useNavigate()
  const [sort, setSort] = useState<SortState>({ key: 'status', dir: 1 })

  const rows = useMemo(() => {
    const g = getters[sort.key]
    return applyFilters(apps, filters, email).sort((a, b) => {
      const x = g(a)
      const y = g(b)
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.name.localeCompare(b.name, 'pt')
    })
  }, [apps, filters, email, sort])

  return (
    <>
      <PageHeader
        title="Tabela"
        description="Todas as apps numa lista que se ordena e filtra. Útil quando o board fica cheio."
        actions={
          canEdit ? (
            <Button variant="primary" onClick={() => navigate("/apps/nova")}>
              <Plus size={14} weight="bold" aria-hidden />
              Nova app
            </Button>
          ) : null
        }
      >
        <FiltersBar />
      </PageHeader>
      <div>
        {loading ? (
          <div className="flex flex-col gap-2" role="status" aria-label="A carregar">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Table size={40} weight="thin" />} title={apps.length ? 'Nenhuma app corresponde aos filtros' : 'Ainda não há apps'} />
        ) : (
          <div className="scroll-x overflow-x-auto rounded-card bg-surface-1 shadow-e2">
            <table className="w-full min-w-[980px] text-[13px]">
              <thead className="bg-surface-2 text-[12px]">
                <tr>
                  <Th sort={sort} setSort={setSort} k="name" className="pl-4">
                    Nome
                  </Th>
                  <Th sort={sort} setSort={setSort} k="status">Estado</Th>
                  <Th sort={sort} setSort={setSort} k="maturity">Maturidade</Th>
                  <Th sort={sort} setSort={setSort} k="priority">Prioridade</Th>
                  <Th sort={sort} setSort={setSort} k="owner">Dono de negócio</Th>
                  <th scope="col" className="px-3.5 py-2.5 text-left font-display font-medium text-ink-subtle">
                    Ambientes
                  </th>
                  <th scope="col" className="px-3.5 py-2.5 text-left font-display font-medium text-ink-subtle">
                    Repositório
                  </th>
                  <Th sort={sort} setSort={setSort} k="goLive">Go-live</Th>
                  <Th sort={sort} setSort={setSort} k="users" className="text-right">
                    Utilizadores
                  </Th>
                  <Th sort={sort} setSort={setSort} k="updated" className="pr-4">
                    Atualizada
                  </Th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-hairline">
                {rows.map((a) => (
                  <tr key={a.id} className="transition-colors duration-150 hover:bg-surface-2">
                    <td className="max-w-72 py-[11px] pr-3.5 pl-4">
                      <Link to={`/apps/${a.id}`} className="block truncate font-display font-semibold text-ink hover:underline">
                        {a.name}
                      </Link>
                      {a.shortDescription ? <span className="block truncate text-[12px] text-ink-subtle">{a.shortDescription}</span> : null}
                    </td>
                    <td className="px-3.5 py-[11px] whitespace-nowrap text-ink-muted"><span className="inline-flex items-center gap-2"><Dot color={STATUS_COLORS[a.status]} />{statusLabel(a.status)}</span></td>
                    <td className="px-3.5 py-[11px]">
                      <Badge>{maturityLabel(a.maturity)}</Badge>
                    </td>
                    <td className="px-3.5 py-[11px] whitespace-nowrap text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <PriorityIcon priority={a.priority} />
                        {priorityLabel(a.priority)}
                      </span>
                    </td>
                    <td className="max-w-44 truncate px-3.5 py-[11px] text-ink-muted">{a.businessOwner.name || <span className="text-ink-tertiary">Por definir</span>}</td>
                    <td className="px-3.5 py-[11px]">
                      <span className="flex gap-1">
                        {ENVS.filter((e) => a.environments[e.key].enabled).map((e) => (
                          <span key={e.key} className="font-mono text-[11px] text-ink-muted">
                            {e.short}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="px-3.5 py-[11px] whitespace-nowrap text-ink-muted">{a.repo.account ? repoAccountLabel(a.repo.account) : <span className="text-ink-tertiary">Por definir</span>}</td>
                    <td className="px-3.5 py-[11px] font-mono text-[12.5px] whitespace-nowrap text-ink-muted tabular">{fmtDate(a.goLiveDate)}</td>
                    <td className="px-3.5 py-[11px] text-right font-mono text-[12.5px] text-ink-muted tabular">{fmtNumber(a.activeUsers)}</td>
                    <td className="px-3.5 py-[11px] pr-4 whitespace-nowrap text-ink-subtle" title={fmtDate(a.updatedAt ?? null)}>
                      {fmtRelative(a.updatedAt ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
