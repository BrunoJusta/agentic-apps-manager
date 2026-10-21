import { useState } from 'react'
import { Kanban, LockKey, ShieldCheck, SignOut, WindowsLogo } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { BrandMark } from '../components/Layout'
import { BOOTSTRAP_ADMIN } from '../lib/constants'
import { Button, Skeleton } from '../components/ui'

export function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas" role="status" aria-label="A carregar">
      <div className="flex w-64 flex-col items-center gap-4">
        <BrandMark className="size-9" />
        <Skeleton className="h-2 w-40" />
      </div>
    </div>
  )
}

export function LoginScreen() {
  const { signIn, error } = useAuth()
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="enter w-full max-w-[400px]">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">Agentic Apps</span>
        </div>
        <div className="mt-8 rounded-modal bg-surface-1 p-6 shadow-panel sm:p-8">
          <h1 className="font-display text-[26px] leading-8 font-semibold tracking-[-0.03em] text-ink">Entrar</h1>
          <p className="mt-2 text-sm text-ink-subtle">Usa a tua conta Microsoft da Sogrape. Só entra quem já tiver acesso dado por um administrador.</p>
          <Button
            variant="primary"
            size="lg"
            className="mt-6 w-full"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              await signIn()
              setBusy(false)
            }}
          >
            {busy ? null : <WindowsLogo size={16} weight="fill" aria-hidden />}
            Entrar com Microsoft
          </Button>
          {error ? (
            <p role="alert" className="notice danger mt-5 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <ul className="mt-8 flex flex-col gap-3 px-1 text-[13px] text-ink-subtle">
          <li className="flex gap-2.5">
            <Kanban size={16} className="mt-0.5 shrink-0 text-ink" aria-hidden />
            <span>Estado, maturidade, equipa e stack de cada agentic app, num board que segue o Light Agile.</span>
          </li>
          <li className="flex gap-2.5">
            <LockKey size={16} className="mt-0.5 shrink-0 text-ink" aria-hidden />
            <span>Secrets cifrados no teu browser. Nem o servidor nem a consola Firebase os conseguem ler.</span>
          </li>
          <li className="flex gap-2.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ink" aria-hidden />
            <span>Cada revelação, cópia ou exportação fica registada na auditoria.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

export function NoAccessScreen() {
  const { email, signOut } = useAuth()
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-modal bg-surface-1 p-6 shadow-panel sm:p-8">
        <BrandMark />
        <h1 className="mt-5 font-display text-[23px] leading-tight font-semibold tracking-[-0.025em] text-ink">Ainda não tens acesso</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Entraste como <span className="font-medium text-ink">{email}</span>, mas esta conta não está na lista de pessoas autorizadas, ou foi desativada.
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Pede acesso a um administrador (por exemplo <span className="font-medium text-ink">{BOOTSTRAP_ADMIN}</span>) e volta a entrar.
        </p>
        <Button className="mt-6" onClick={signOut}>
          <SignOut size={16} aria-hidden />
          Terminar sessão
        </Button>
      </div>
    </div>
  )
}

export function ErrorScreen() {
  const { error, signOut } = useAuth()
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md rounded-modal bg-surface-1 p-6 shadow-panel sm:p-8">
        <h1 className="font-display text-[23px] leading-tight font-semibold tracking-[-0.025em] text-ink">Não foi possível carregar a tua conta</h1>
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
        <p className="mt-2 text-sm text-ink-subtle">Confirma que as regras do Firestore foram publicadas para a base de dados agentic-apps-prod.</p>
        <Button className="mt-6" onClick={signOut}>
          Terminar sessão
        </Button>
      </div>
    </div>
  )
}
