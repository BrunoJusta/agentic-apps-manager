import { useMemo, useState } from 'react'
import { Archive, MagnifyingGlass, Rows, SquaresFour } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { useVault } from '../context/VaultContext'
import { linkedItems } from '../lib/vault-utils'
import { matchesSearch } from '../lib/app-utils'
import { isFinished } from '../lib/constants'
import type { StatusKey, VaultItem } from '../lib/types'
import { PageHeader } from '../components/Layout'
import { AppCardLink } from '../components/AppCard'
import { AppsTable } from '../components/AppsTable'
import { EmptyState, Segmented, Skeleton } from '../components/ui'

type Which = 'todas' | Extract<StatusKey, 'producao' | 'descontinuada'>

/** Apps que já saíram do pipeline: em produção ou descontinuadas. */
export function FinishedPage() {
  const { apps, loading } = useApps()
  const { itemsById } = useVault()
  const [q, setQ] = useState('')
  const [which, setWhich] = useState<Which>('todas')
  const [view, setView] = useState<'cartoes' | 'tabela'>('cartoes')

  const finished = useMemo(() => apps.filter((a) => isFinished(a.status)), [apps])
  const counts = {
    todas: finished.length,
    producao: finished.filter((a) => a.status === 'producao').length,
    descontinuada: finished.filter((a) => a.status === 'descontinuada').length,
  }
  const rows = useMemo(
    () => finished.filter((a) => (which === 'todas' || a.status === which) && matchesSearch(a, q)).sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    [finished, which, q],
  )
  const secretsByApp = useMemo(() => {
    const m = new Map<string, VaultItem[]>()
    for (const a of apps) m.set(a.id, linkedItems(a, itemsById).map((x) => x.item))
    return m
  }, [apps, itemsById])

  return (
    <>
      <PageHeader title="Finalizadas" description="Apps que já saíram do pipeline: em produção ou descontinuadas. Pedidos de alteração, updates e novos módulos registam-se no separador Pedidos de cada app.">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-tertiary" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar apps…"
              aria-label="Filtrar apps finalizadas"
              className="h-[34px] w-full rounded-full bg-surface-1 pr-3 pl-8 text-[13px] text-ink shadow-ring placeholder:text-ink-tertiary focus:shadow-[0_0_0_1px_var(--ink),0_0_0_4px_var(--accent-tint)] focus:outline-none focus-visible:outline-none"
              autoComplete="off"
            />
          </div>
          <Segmented<Which>
            label="Estado"
            value={which}
            onChange={setWhich}
            options={[
              { value: 'todas', label: 'Todas', count: counts.todas },
              { value: 'producao', label: 'Produção', count: counts.producao },
              { value: 'descontinuada', label: 'Descontinuadas', count: counts.descontinuada },
            ]}
          />
          <div className="ml-auto">
            <Segmented<'cartoes' | 'tabela'>
              label="Vista"
              value={view}
              onChange={setView}
              options={[
                { value: 'cartoes', title: 'Cartões', label: (<><SquaresFour size={14} aria-hidden /><span className="hidden lg:inline">Cartões</span></>) },
                { value: 'tabela', title: 'Tabela', label: (<><Rows size={14} aria-hidden /><span className="hidden lg:inline">Tabela</span></>) },
              ]}
            />
          </div>
        </div>
      </PageHeader>

      <div className="pb-10">
        {loading ? (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]" role="status" aria-label="A carregar">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 rounded-card" />
            ))}
          </div>
        ) : finished.length === 0 ? (
          <EmptyState icon={<Archive size={22} />} title="Ainda não há apps finalizadas" body="Quando uma app passar para Produção ou for descontinuada, sai do board e aparece aqui." />
        ) : view === 'tabela' ? (
          <AppsTable apps={rows} empty={<EmptyState title="Nenhuma app corresponde aos filtros" />} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhuma app corresponde aos filtros" />
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr))]">
            {rows.map((a, i) => (
              <AppCardLink key={a.id} app={a} secrets={secretsByApp.get(a.id) ?? []} index={i} showStatus />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
