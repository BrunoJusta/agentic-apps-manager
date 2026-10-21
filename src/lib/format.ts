import type { Timestamp } from 'firebase/firestore'

const dateFmt = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const rel = new Intl.RelativeTimeFormat('pt-PT', { numeric: 'auto' })
const num = new Intl.NumberFormat('pt-PT')
const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

type Dateish = Timestamp | Date | string | null | undefined

export function toDate(v: Dateish): Date | null {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v === 'string') {
    const d = new Date(v.length === 10 ? v + 'T00:00:00' : v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof (v as Timestamp).toDate === 'function') return (v as Timestamp).toDate()
  return null
}

export const fmtDate = (v: Dateish) => {
  const d = toDate(v)
  return d ? dateFmt.format(d) : ''
}
export const fmtDateTime = (v: Dateish) => {
  const d = toDate(v)
  return d ? dateTimeFmt.format(d) : ''
}
export const fmtNumber = (n: number | null | undefined) => (n == null ? '' : num.format(n))
export const fmtEur = (n: number | null | undefined) => (n == null ? '' : eur.format(n))

export function fmtRelative(v: Dateish, now = Date.now()): string {
  const d = toDate(v)
  if (!d) return ''
  const s = Math.round((d.getTime() - now) / 1000)
  const abs = Math.abs(s)
  if (abs < 60) return rel.format(s, 'second')
  if (abs < 3600) return rel.format(Math.round(s / 60), 'minute')
  if (abs < 86400) return rel.format(Math.round(s / 3600), 'hour')
  if (abs < 86400 * 30) return rel.format(Math.round(s / 86400), 'day')
  return fmtDate(d)
}
