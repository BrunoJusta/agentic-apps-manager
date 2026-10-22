import type { CSSProperties } from 'react'
import type { RequestStatus, StatusKey } from './types'

/**
 * Paleta das áreas: tons frios e limpos, da mesma família do azul-céu #39C2EF e da ardósia #4C4F69,
 * com um âmbar e um coral para dar contraste. O texto das etiquetas mistura a cor com ardósia profunda,
 * o que garante contraste AA (4,5:1 ou mais) em todas.
 */
export const ENTITY_PALETTE = ['#39C2EF', '#6C7CF0', '#2DB9A5', '#A27BF0', '#E9A23B', '#62B85A', '#F07A7A', '#E06FB6'] as const

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

/** Cor estável para uma área (cadeia de valor): o mesmo nome dá sempre a mesma cor. */
export function areaColor(area: string): string | undefined {
  const a = area.trim().toLowerCase()
  if (!a) return undefined
  let h = 0
  for (let i = 0; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) >>> 0
  return ENTITY_PALETTE[h % ENTITY_PALETTE.length]
}

/** Passa a cor da entidade ao CSS por --c. */
export const entityStyle = (c: string | undefined, extra?: CSSProperties): CSSProperties => ({ ...(c ? { ['--c' as string]: c } : {}), ...extra })
