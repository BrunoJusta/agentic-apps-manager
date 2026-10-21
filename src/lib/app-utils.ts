import { emptyApp, emptyEnvironment, PRIORITIES } from './constants'
import type { AgenticApp, AppInput, EnvKey, Person } from './types'

const ENV_KEYS: EnvKey[] = ['dev', 'qa', 'prod']

const asPerson = (p: unknown): Person => {
  const o = (p ?? {}) as Partial<Person>
  return { name: String(o.name ?? ''), email: String(o.email ?? '') }
}
const asPeople = (v: unknown): Person[] => (Array.isArray(v) ? v.map(asPerson) : [])
const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : [])

/** Junta um documento (possivelmente incompleto ou antigo) com os valores por defeito. */
export function normalizeApp(id: string, raw: Record<string, unknown>): AgenticApp {
  const base = emptyApp()
  const r = raw as Partial<AgenticApp>
  const envs = {} as AgenticApp['environments']
  for (const k of ENV_KEYS) {
    const e = (r.environments?.[k] ?? {}) as Partial<AgenticApp['environments'][EnvKey]>
    envs[k] = {
      ...emptyEnvironment(base.environments[k].enabled),
      ...e,
      variables: Array.isArray(e.variables) ? e.variables.map((v) => ({ key: String(v.key ?? ''), value: String(v.value ?? ''), note: v.note ? String(v.note) : '' })) : [],
    }
  }
  return {
    ...base,
    ...r,
    id,
    icon: typeof r.icon === 'string' && r.icon.startsWith('data:image/') ? r.icon : '',
    businessOwner: asPerson(r.businessOwner),
    aiLead: asPerson(r.aiLead),
    developers: asPeople(r.developers),
    supportL1: asPeople(r.supportL1),
    supportL2: asPeople(r.supportL2),
    activeUsers: typeof r.activeUsers === 'number' ? r.activeUsers : null,
    stack: {
      frontend: asStrings(r.stack?.frontend),
      backend: asStrings(r.stack?.backend),
      llm: asStrings(r.stack?.llm),
      frameworks: asStrings(r.stack?.frameworks),
      auth: String(r.stack?.auth ?? ''),
    },
    environments: envs,
    repo: { ...base.repo, ...(r.repo ?? {}) },
    links: Array.isArray(r.links) ? r.links.map((l) => ({ label: String(l.label ?? ''), url: String(l.url ?? '') })) : [],
    governance: {
      ...base.governance,
      ...(r.governance ?? {}),
      monthlyCost: typeof r.governance?.monthlyCost === 'number' ? r.governance.monthlyCost : null,
    },
  }
}

/** Remove campos de sistema para gravar. */
export function toInput(app: AgenticApp): AppInput {
  const { id: _id, createdAt: _c, createdBy: _cb, updatedAt: _u, updatedBy: _ub, ...rest } = app
  return rest
}

export function allTags(app: AgenticApp): string[] {
  return [...app.stack.frontend, ...app.stack.backend, ...app.stack.llm, ...app.stack.frameworks]
}

const filled = (s: string | undefined | null) => !!s && s.trim().length > 0

/**
 * Checklist de go-live. Uma app só passa para Produção com isto completo:
 * pessoas, repositório e ambiente de produção.
 */
export function productionReadiness(app: Pick<AgenticApp, 'businessOwner' | 'aiLead' | 'developers' | 'supportL1' | 'repo' | 'environments'>) {
  const prod = app.environments.prod
  const items = [
    { ok: filled(app.businessOwner.name), label: 'Dono de negócio definido' },
    { ok: filled(app.aiLead.name), label: 'AI Lead definido' },
    { ok: app.developers.some((d) => filled(d.name)), label: 'Pelo menos um dev na equipa' },
    { ok: app.supportL1.some((d) => filled(d.name)), label: 'Equipa de suporte (nível 1) definida' },
    { ok: filled(app.repo.url), label: 'Repositório com URL' },
    { ok: filled(app.repo.account), label: 'Conta do repositório (pessoal ou Sogrape)' },
    { ok: prod.enabled, label: 'Ambiente de produção ativo' },
    { ok: prod.enabled && filled(prod.hosting), label: 'Alojamento de produção' },
    { ok: prod.enabled && filled(prod.appUrl), label: 'URL da app em produção' },
    { ok: prod.enabled && filled(prod.dbType), label: 'Base de dados de produção' },
  ]
  return { items, ready: items.every((i) => i.ok), missing: items.filter((i) => !i.ok).map((i) => i.label) }
}

const FIELD_LABELS: Record<string, string> = {
  name: 'nome',
  icon: 'ícone',
  shortDescription: 'descrição curta',
  description: 'descrição',
  area: 'área',
  priority: 'prioridade',
  status: 'estado',
  maturity: 'maturidade',
  businessOwner: 'dono de negócio',
  aiLead: 'AI Lead',
  developers: 'devs',
  supportL1: 'suporte N1',
  supportL2: 'suporte N2',
  startDate: 'data de início',
  goLiveDate: 'data de go-live',
  activeUsers: 'utilizadores ativos',
  stack: 'stack',
  environments: 'ambientes',
  repo: 'repositório',
  links: 'links',
  governance: 'governo',
}

/** Lista legível dos campos que mudaram entre duas versões. */
export function changedFields(before: AppInput, after: AppInput): string[] {
  const out: string[] = []
  for (const key of Object.keys(FIELD_LABELS) as (keyof AppInput)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out.push(FIELD_LABELS[key])
  }
  return out
}

export function matchesSearch(app: AgenticApp, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const hay = [
    app.name,
    app.shortDescription,
    app.area,
    app.businessOwner.name,
    app.aiLead.name,
    ...app.developers.map((d) => d.name),
    ...allTags(app),
    app.repo.url,
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(s)
}

export const priorityRank = (k: AgenticApp['priority']) => PRIORITIES.find((p) => p.key === k)?.rank ?? 9

export function sortForBoard(a: AgenticApp, b: AgenticApp) {
  return priorityRank(a.priority) - priorityRank(b.priority) || a.name.localeCompare(b.name, 'pt')
}

export function personMatches(p: Person, email: string) {
  return !!email && p.email.trim().toLowerCase() === email
}

export function isMember(app: AgenticApp, email: string) {
  return [app.businessOwner, app.aiLead, ...app.developers, ...app.supportL1, ...app.supportL2].some((p) => personMatches(p, email))
}

/** Dias até uma data ISO (yyyy-mm-dd). Negativo se já passou. */
export function daysUntil(iso: string, now = new Date()): number | null {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((d.getTime() - today.getTime()) / 86_400_000)
}
