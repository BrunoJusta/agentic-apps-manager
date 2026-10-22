import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react'

type Tone = 'success' | 'error'
interface ToastAction {
  label: string
  onClick: () => void
}
interface Toast {
  id: number
  tone: Tone
  text: string
  action?: ToastAction
}

const Ctx = createContext<(text: string, tone?: Tone, action?: ToastAction) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback(
    (text: string, tone: Tone = 'success', action?: ToastAction) => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t.slice(-3), { id, tone, text, action }])
      window.setTimeout(() => dismiss(id), tone === 'error' || action ? 8000 : 4000)
    },
    [dismiss],
  )
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="enter pointer-events-auto flex max-w-[min(520px,100%)] items-center gap-3 rounded-full bg-surface-3 py-2 pr-2 pl-3.5 font-display text-[13.5px] font-medium shadow-panel">
            {t.tone === 'success' ? (
              <CheckCircle size={16} weight="fill" className="shrink-0 text-success" aria-hidden />
            ) : (
              <WarningCircle size={16} weight="fill" className="shrink-0 text-danger" aria-hidden />
            )}
            <span className="min-w-0 flex-1 text-ink">{t.text}</span>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick()
                  dismiss(t.id)
                }}
                className="h-7 shrink-0 rounded-full bg-ink px-3 font-display text-[12.5px] font-medium text-canvas transition-transform active:scale-[0.97]"
              >
                {t.action.label}
              </button>
            ) : null}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Fechar aviso" className="flex size-6 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-sel hover:text-ink">
              <X size={12} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
