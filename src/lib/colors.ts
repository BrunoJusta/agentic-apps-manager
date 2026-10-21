import type { CSSProperties } from 'react'
import type { RequestStatus, StatusKey } from './types'

/** Paleta terrosa da Sogrape. É a única cor viva da interface, e vem sempre dos dados. */
export const ENTITY_PALETTE = ['#4F7A3A', '#7A2338', '#B15533', '#B07A12', '#2F6B73', '#9B4D6B', '#5E6B7A'] as const

/** Cor de cada fase (estado). */
export const STATUS_COLORS: Record<StatusKey, string> = {
  ideia: '#5E6B7A',
  discovery: '#2F6B73',
  desenvolvimento: '#B07A12',
  qa: '#9B4D6B',
  producao: '#4F7A3A',
  descontinuada: '#7A2338',
}

/** Cor de cada estado de um pedido. */
export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  novo: '#5E6B7A',
  analise: '#B07A12',
  curso: '#2F6B73',
  concluido: '#4F7A3A',
  rejeitado: '#7A2338',
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
