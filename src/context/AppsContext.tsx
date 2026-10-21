import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { subscribeApps, subscribeRequestsIndex } from '../data/store'
import type { AgenticApp, AppRequest } from '../lib/types'

interface AppsState {
  apps: AgenticApp[]
  loading: boolean
  error: string | null
  byId: (id: string) => AgenticApp | undefined
  requests: AppRequest[]
}

const Ctx = createContext<AppsState | null>(null)

export function AppsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [apps, setApps] = useState<AgenticApp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requests, setRequests] = useState<AppRequest[]>([])

  useEffect(() => {
    if (status !== 'ready') return
    setLoading(true)
    return subscribeApps(
      (rows) => {
        setApps(rows)
        setLoading(false)
        setError(null)
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      },
    )
  }, [status])

  useEffect(() => {
    if (status !== 'ready') return
    return subscribeRequestsIndex(setRequests, () => setRequests([]))
  }, [status])

  const value = useMemo<AppsState>(
    () => ({ apps, loading, error, byId: (id) => apps.find((a) => a.id === id), requests }),
    [apps, loading, error, requests],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApps() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApps fora do AppsProvider')
  return v
}
