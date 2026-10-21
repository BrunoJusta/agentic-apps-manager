import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { AUTO_LOCK_MINUTES } from '../lib/constants'
import { createUserKeys, openPrivateKey, unwrapVaultKey, verifyVaultCheck } from '../lib/crypto'
import type { SecretDoc, UserKeys, VaultGrant, VaultMeta } from '../lib/types'
import {
  initVault,
  resetKeys,
  saveMyKeys,
  subscribeGrant,
  subscribeSecretsIndex,
  subscribeUserKeys,
  subscribeVaultMeta,
} from '../data/store'

export type VaultStatus =
  | 'unavailable' // Viewer: nunca vê secrets
  | 'loading'
  | 'not-initialized' // ainda não existe chave do cofre
  | 'no-keys' // o utilizador ainda não criou as chaves pessoais
  | 'no-grant' // tem chaves, mas ninguém lhe deu acesso
  | 'stale-grant' // o acesso é de uma versão antiga da chave (houve rotação)
  | 'locked'
  | 'unlocked'

interface VaultState {
  status: VaultStatus
  meta: VaultMeta | null
  myKeys: UserKeys | null
  key: CryptoKey | null
  secrets: SecretDoc[]
  secretsLoaded: boolean
  unlock: (passphrase: string) => Promise<void>
  lock: () => void
  createKeys: (passphrase: string) => Promise<void>
  initialize: (passphrase: string) => Promise<void>
  resetMyKeys: () => Promise<void>
  /** usado pela rotação: troca a chave em memória pela nova */
  adoptKey: (k: CryptoKey) => void
}

const Ctx = createContext<VaultState | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, email, canEdit, isAdmin, actor } = useAuth()
  const enabled = authStatus === 'ready' && canEdit
  const [meta, setMeta] = useState<VaultMeta | null | undefined>(undefined)
  const [myKeys, setMyKeys] = useState<UserKeys | null | undefined>(undefined)
  const [grant, setGrant] = useState<VaultGrant | null | undefined>(undefined)
  const [key, setKey] = useState<CryptoKey | null>(null)
  const [keyVersion, setKeyVersion] = useState<number | null>(null)
  const [secrets, setSecrets] = useState<SecretDoc[]>([])
  const [secretsLoaded, setSecretsLoaded] = useState(false)
  const lastActivity = useRef(Date.now())

  useEffect(() => {
    if (!enabled) {
      setMeta(undefined)
      setMyKeys(undefined)
      setGrant(undefined)
      setKey(null)
      setSecrets([])
      setSecretsLoaded(false)
      return
    }
    const subs = [
      subscribeVaultMeta(setMeta, () => setMeta(null)),
      subscribeUserKeys(email, setMyKeys, () => setMyKeys(null)),
      subscribeGrant(email, setGrant, () => setGrant(null)),
      subscribeSecretsIndex(
        (rows) => {
          setSecrets(rows)
          setSecretsLoaded(true)
        },
        () => setSecretsLoaded(true),
      ),
    ]
    return () => subs.forEach((u) => u())
  }, [enabled, email])

  const lock = useCallback(() => {
    setKey(null)
    setKeyVersion(null)
  }, [])

  // Se a chave rodar noutra sessão, a chave em memória deixa de servir.
  useEffect(() => {
    if (key && meta && keyVersion !== null && meta.version !== keyVersion) lock()
  }, [meta, key, keyVersion, lock])

  // Se o acesso for retirado, bloqueia logo.
  useEffect(() => {
    if (key && grant === null) lock()
  }, [grant, key, lock])

  // Bloqueio automático por inatividade.
  useEffect(() => {
    if (!key) return
    const bump = () => {
      lastActivity.current = Date.now()
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const t = window.setInterval(() => {
      if (Date.now() - lastActivity.current > AUTO_LOCK_MINUTES * 60_000) lock()
    }, 15_000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      window.clearInterval(t)
    }
  }, [key, lock])

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!myKeys || !grant || !meta) throw new Error('O cofre não está pronto para desbloquear.')
      const priv = await openPrivateKey(myKeys.encPrivateKey, passphrase)
      const k = await unwrapVaultKey(grant.wrappedKey, priv)
      if (!(await verifyVaultCheck(k, meta.check))) throw new Error('A chave que recebeste não corresponde à atual. Pede a um Admin para te dar acesso outra vez.')
      lastActivity.current = Date.now()
      setKey(k)
      setKeyVersion(meta.version)
    },
    [myKeys, grant, meta],
  )

  const createKeys = useCallback(
    async (passphrase: string) => {
      const k = await createUserKeys(passphrase)
      await saveMyKeys(email, { publicKey: k.publicKey, fingerprint: k.fingerprint, encPrivateKey: k.encPrivateKey }, actor)
    },
    [email, actor],
  )

  const initialize = useCallback(
    async (passphrase: string) => {
      if (!isAdmin) throw new Error('Só um Admin pode inicializar o cofre.')
      let publicKey = myKeys?.publicKey
      if (myKeys) {
        await openPrivateKey(myKeys.encPrivateKey, passphrase) // confirma a passphrase
      } else {
        const k = await createUserKeys(passphrase)
        await saveMyKeys(email, { publicKey: k.publicKey, fingerprint: k.fingerprint, encPrivateKey: k.encPrivateKey }, actor)
        publicKey = k.publicKey
      }
      const vk = await initVault(actor, publicKey!)
      lastActivity.current = Date.now()
      setKey(vk)
      setKeyVersion(1)
    },
    [isAdmin, myKeys, email, actor],
  )

  const resetMyKeys = useCallback(async () => {
    lock()
    await resetKeys(email, actor)
  }, [email, actor, lock])

  const adoptKey = useCallback(
    (k: CryptoKey) => {
      lastActivity.current = Date.now()
      setKey(k)
      setKeyVersion((meta?.version ?? 0) + 1)
    },
    [meta],
  )

  let status: VaultStatus
  if (!enabled) status = 'unavailable'
  else if (meta === undefined || myKeys === undefined || grant === undefined) status = 'loading'
  else if (key) status = 'unlocked'
  else if (!meta) status = 'not-initialized'
  else if (!myKeys) status = 'no-keys'
  else if (!grant) status = 'no-grant'
  else if (grant.version !== meta.version) status = 'stale-grant'
  else status = 'locked'

  const value = useMemo<VaultState>(
    () => ({
      status,
      meta: meta ?? null,
      myKeys: myKeys ?? null,
      key,
      secrets,
      secretsLoaded,
      unlock,
      lock,
      createKeys,
      initialize,
      resetMyKeys,
      adoptKey,
    }),
    [status, meta, myKeys, key, secrets, secretsLoaded, unlock, lock, createKeys, initialize, resetMyKeys, adoptKey],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useVault() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useVault fora do VaultProvider')
  return v
}

