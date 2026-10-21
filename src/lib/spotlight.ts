import type { PointerEvent } from 'react'

/** Atualiza a posição do brilho sem passar pelo estado do React. */
export function trackSpotlight(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}
