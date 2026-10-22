import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth'
import { auth, microsoftProvider } from '../lib/firebase'
import { ALLOWED_DOMAIN, BOOTSTRAP_ADMIN } from '../lib/constants'
import type { Role, UserProfile } from '../lib/types'
import { bootstrapAdmin, logAudit, subscribeUser, touchLogin, type Actor } from '../data/store'

type Status = 'loading' | 'signed-out' | 'no-access' | 'ready' | 'error'

interface AuthState {
  status: Status
  error: string | null
  email: string
  name: string
  role: Role | null
  profile: UserProfile | null
  actor: Actor
  isAdmin: boolean
  canEdit: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

function emailOf(u: User): string {
  const e = u.email || u.providerData.find((p) => p.email)?.email || ''
  return e.trim().toLowerCase()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [fbUser, setFbUser] = useState<User | null | undefined>(undefined)
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined)
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const loggedRef = useRef(false)

  useEffect(() => onAuthStateChanged(auth, (u) => setFbUser(u)), [])

  const email = fbUser ? emailOf(fbUser) : ''
  const name = fbUser?.displayName || email.split('@')[0] || ''

  useEffect(() => {
    if (fbUser === undefined) return
    if (!fbUser) {
      setStatus('signed-out')
      setProfile(undefined)
      loggedRef.current = false
      return
    }
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      setError(`Só contas Microsoft ${ALLOWED_DOMAIN} podem entrar. Entraste com ${email || 'uma conta sem email'}.`)
      fbSignOut(auth).catch(() => {})
      return
    }
    setStatus('loading')
    return subscribeUser(
      email,
      async (p) => {
        // Depois do logout o Firestore ainda pode responder: ignoramos.
        if (!auth.currentUser) return
        if (!p && email === BOOTSTRAP_ADMIN) {
          try {
            await bootstrapAdmin(email, name)
          } catch (e) {
            setError((e as Error).message)
            setStatus('error')
          }
          return
        }
        setProfile(p)
        if (!p || !p.active) {
          setStatus('no-access')
          return
        }
        setStatus('ready')
        if (!loggedRef.current) {
          loggedRef.current = true
          touchLogin(email, name).catch(() => {})
          logAudit({ email, name }, 'login')
        }
      },
      (e) => {
        // Depois do logout as regras recusam a leitura: não é falta de acesso, é sessão terminada.
        if (!auth.currentUser) return
        // Sem documento de utilizador, as regras recusam: tratamos como sem acesso.
        if (/permission/i.test(e.message)) setStatus('no-access')
        else {
          setError(e.message)
          setStatus('error')
        }
      },
    )
  }, [fbUser, email, name])

  const signIn = useCallback(async () => {
    setError(null)
    try {
      await signInWithPopup(auth, microsoftProvider())
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      if (code === 'auth/popup-blocked') setError('O browser bloqueou a janela de login. Autoriza pop-ups para este site e tenta outra vez.')
      else setError(`Não foi possível entrar (${code || (e as Error).message}).`)
    }
  }, [])

  const signOut = useCallback(async () => {
    await fbSignOut(auth)
    // Recarrega na raiz: mostra o login e limpa tudo o que estava em memória (incluindo a chave do Credentials Vault).
    window.location.replace('/')
  }, [])

  const role = status === 'ready' ? (profile?.role ?? null) : null
  const value = useMemo<AuthState>(
    () => ({
      status,
      error,
      email,
      name: profile?.displayName || name,
      role,
      profile: profile ?? null,
      actor: { email, name: profile?.displayName || name },
      isAdmin: role === 'admin',
      canEdit: role === 'admin' || role === 'editor',
      signIn,
      signOut,
    }),
    [status, error, email, name, role, profile, signIn, signOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do AuthProvider')
  return v
}
