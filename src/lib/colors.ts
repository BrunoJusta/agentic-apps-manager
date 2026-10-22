import type { CSSProperties } from 'react'
import type { RequestStatus, StatusKey } from './types'

/**
 * Paleta das áreas: tons frios e limpos, da mesma família do azul-céu #39C2EF e da ardósia #4C4F69,
 * com um âmbar e um coral para dar contraste. O texto das etiquetas mistura a cor com ardósia profunda,
 * o que garante contraste AA (4,5:1 ou mais) em todas.
 */
export const ENTITY_PALETTE = ['#6C7CF0', '#2DB9A5', '#E9A23B', '#A27BF0', '#62B85A', '#F07A7A', '#E06FB6', '#3E8FD8', '#A8B83A', '#D9822B'] as const

/** Áreas com cor fixa. O azul-céu fica reservado para Digital & Data, por isso não entra na paleta acima. */
const AREA_COLORS: Record<string, string> = {
  'digital & data': '#39C2EF',
  'digital and data': '#39C2EF',
  'digital e data': '#39C2EF',
}

const areaKey = (area: string) => area.trim().toLowerCase().replace(/\s+/g, ' ')

/** Cores atribuídas às áreas que existem: uma cor diferente para cada, pela ordem em que as áreas apareceram. */
let assigned = new Map<string, string>()

/**
 * Regista as áreas existentes (pela ordem em que apareceram) e dá a cada uma uma cor da paleta,
 * sem repetir enquanto houver cores livres. Chamado sempre que a lista de apps muda.
 */
export function registerAreas(areasInOrder: string[]) {
  const next = new Map<string, string>()
  const used = new Set<string>()
  const pending: string[] = []
  for (const raw of areasInOrder) {
    const k = areaKey(raw)
    if (!k || next.has(k) || pending.includes(k)) continue
    const fixed = AREA_COLORS[k]
    if (fixed) next.set(k, fixed)
    else pending.push(k)
  }
  // Quem já tinha cor mantém-na, para as cores não saltarem quando aparece uma área nova.
  for (const k of pending) {
    const prev = assigned.get(k)
    if (prev && !used.has(prev) && (ENTITY_PALETTE as readonly string[]).includes(prev)) {
      next.set(k, prev)
      used.add(prev)
    }
  }
  let i = 0
  for (const k of pending) {
    if (next.has(k)) continue
    const free = ENTITY_PALETTE.find((c) => !used.has(c))
    const c = free ?? ENTITY_PALETTE[i++ % ENTITY_PALETTE.length]
    next.set(k, c)
    used.add(c)
  }
  assigned = next
}

/** Cor de cada fase: de ardósia neutra (Idea) a azul (em curso), âmbar (testes) e verde (Production). */
export const STATUS_COLORS: Record<StatusKey, string> = {
  ideia: '#8E91AB',
  discovery: '#8B7CF6',
  desenvolvimento: '#39C2EF',
  qa: '#F2A93B',
  producao: '#2FBF8F',
  descontinuada: '#EF6F8A',
}

/** Cor de cada estado de um pedido. */
export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  novo: '#8E91AB',
  analise: '#F2A93B',
  curso: '#39C2EF',
  concluido: '#2FBF8F',
  rejeitado: '#EF6F8A',
}

/** Cor de uma área: fixa, atribuída sem repetir, ou (para uma área ainda por registar) calculada a partir do nome. */
export function areaColor(area: string): string | undefined {
  const k = areaKey(area)
  if (!k) return undefined
  const c = AREA_COLORS[k] ?? assigned.get(k)
  if (c) return c
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0
  return ENTITY_PALETTE[h % ENTITY_PALETTE.length]
}

/** Passa a cor da entidade ao CSS por --c. */
export const entityStyle = (c: string | undefined, extra?: CSSProperties): CSSProperties => ({ ...(c ? { ['--c' as string]: c } : {}), ...extra })
