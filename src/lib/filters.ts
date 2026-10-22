import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { allTags, matchesSearch } from './app-utils'
import type { AgenticApp, MaturityKey, PriorityKey, RepoAccount } from './types'

export type GroupBy = 'status' | 'maturity' | 'account' | 'area'
export type ViewMode = 'kanban' | 'tabela'

export interface Filters {
  q: string
  maturity: MaturityKey | ''
  priority: PriorityKey | ''
  account: RepoAccount | 'none' | ''
  tag: string
  hideArchived: boolean
  group: GroupBy
  view: ViewMode
}

/** Filtros vivem no URL: sobrevivem a refresh e dá para partilhar o link. */
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const filters: Filters = useMemo(
    () => ({
      q: params.get('q') ?? '',
      maturity: (params.get('maturidade') as MaturityKey) ?? '',
      priority: (params.get('prioridade') as PriorityKey) ?? '',
      account: (params.get('conta') as Filters['account']) ?? '',
      tag: params.get('tag') ?? '',
      hideArchived: params.get('arquivadas') !== '1',
      group: ((params.get('agrupar') as GroupBy) || 'status') as GroupBy,
      view: params.get('vista') === 'tabela' ? 'tabela' : 'kanban',
    }),
    [params],
  )
  const set = useCallback(
    (patch: Partial<Filters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          const map: Record<keyof Filters, string> = {
            q: 'q',
            maturity: 'maturidade',
            priority: 'prioridade',
            account: 'conta',
            tag: 'tag',
            hideArchived: 'arquivadas',
            group: 'agrupar',
            view: 'vista',
          }
          for (const [k, v] of Object.entries(patch) as [keyof Filters, unknown][]) {
            const key = map[k]
            let val: string
            if (k === 'hideArchived') val = v ? '' : '1'
            else if (k === 'group') val = v === 'status' ? '' : String(v)
            else if (k === 'view') val = v === 'kanban' ? '' : String(v)
            else val = String(v ?? '')
            if (val) next.set(key, val)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )
  const active = !!(filters.q || filters.maturity || filters.priority || filters.account || filters.tag)
  const clear = useCallback(() => set({ q: '', maturity: '', priority: '', account: '', tag: '' }), [set])
  return { filters, set, active, clear }
}

export function applyFilters(apps: AgenticApp[], f: Filters): AgenticApp[] {
  return apps.filter((a) => {
    if (!matchesSearch(a, f.q)) return false
    if (f.maturity && a.maturity !== f.maturity) return false
    if (f.priority && a.priority !== f.priority) return false
    if (f.account === 'none' ? a.repo.account !== '' : f.account && a.repo.account !== f.account) return false
    if (f.tag && !allTags(a).some((t) => t.toLowerCase() === f.tag.toLowerCase())) return false
    return true
  })
}
