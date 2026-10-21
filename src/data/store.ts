import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { changedFields, normalizeApp } from '../lib/app-utils'
import { statusLabel, maturityLabel } from '../lib/constants'
import {
  decryptString,
  encryptString,
  generateVaultKey,
  makeVaultCheck,
  secretAad,
  wrapVaultKey,
} from '../lib/crypto'
import type {
  AgenticApp,
  AppRequest,
  AppInput,
  AuditAction,
  AuditEntry,
  EnvKey,
  HistoryEntry,
  MaturityKey,
  Role,
  SecretDoc,
  SecretType,
  StatusKey,
  UserKeys,
  UserProfile,
  Variable,
  VaultGrant,
  VaultMeta,
} from '../lib/types'

export interface Actor {
  email: string
  name: string
}

type Err = (e: Error) => void

/* ---------- Auditoria ---------- */

export async function logAudit(actor: Actor, action: AuditAction, extra: Omit<AuditEntry, 'id' | 'by' | 'action' | 'at'> = {}) {
  try {
    await addDoc(collection(db, 'audit'), { ...clean(extra), by: actor.email, action, at: serverTimestamp() })
  } catch (e) {
    console.warn('[audit] falhou', e)
  }
}

export function subscribeAudit(cb: (rows: AuditEntry[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'audit'), orderBy('at', 'desc'), limit(500)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditEntry, 'id'>) }))),
    onErr,
  )
}

/* ---------- Apps ---------- */

export function subscribeApps(cb: (apps: AgenticApp[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    collection(db, 'apps'),
    (s) => cb(s.docs.map((d) => normalizeApp(d.id, d.data()))),
    onErr,
  )
}

async function addHistory(appId: string, actor: Actor, action: string, summary: string) {
  await addDoc(collection(db, 'apps', appId, 'history'), {
    at: serverTimestamp(),
    by: actor.email,
    byName: actor.name,
    action,
    summary,
  })
}

export async function createApp(input: AppInput, actor: Actor): Promise<string> {
  const ref = await addDoc(collection(db, 'apps'), {
    ...input,
    createdAt: serverTimestamp(),
    createdBy: actor.email,
    updatedAt: serverTimestamp(),
    updatedBy: actor.email,
  })
  await addHistory(ref.id, actor, 'create', 'Criou a app')
  return ref.id
}

/** Campos que deixaram de existir; são apagados quando a ficha é gravada. */
const LEGACY_FIELDS = ['businessOwner', 'aiLead', 'developers', 'supportL1', 'supportL2', 'itContact']

export async function updateApp(id: string, before: AppInput, after: AppInput, actor: Actor) {
  const fields = changedFields(before, after)
  if (!fields.length) return
  const legacy = Object.fromEntries(LEGACY_FIELDS.map((k) => [k, deleteField()]))
  await updateDoc(doc(db, 'apps', id), { ...after, ...legacy, updatedAt: serverTimestamp(), updatedBy: actor.email })
  await addHistory(id, actor, 'update', `Alterou ${fields.join(', ')}`)
}

export async function moveApp(app: AgenticApp, field: 'status' | 'maturity', value: StatusKey | MaturityKey, actor: Actor) {
  if (app[field] === value) return
  await updateDoc(doc(db, 'apps', app.id), { [field]: value, updatedAt: serverTimestamp(), updatedBy: actor.email })
  const label = field === 'status' ? statusLabel : maturityLabel
  const from = label(app[field] as never)
  const to = label(value as never)
  await addHistory(app.id, actor, field, `${field === 'status' ? 'Estado' : 'Maturidade'}: ${from} → ${to}`)
}

export async function saveVariables(app: AgenticApp, env: EnvKey, variables: Variable[], actor: Actor, summary: string) {
  await updateDoc(doc(db, 'apps', app.id), {
    [`environments.${env}.variables`]: variables,
    updatedAt: serverTimestamp(),
    updatedBy: actor.email,
  })
  await addHistory(app.id, actor, 'variables', summary)
}

export async function importApps(inputs: AppInput[], actor: Actor): Promise<number> {
  let n = 0
  for (const input of inputs) {
    await createApp(input, actor)
    n++
  }
  return n
}

export async function deleteApp(app: AgenticApp, actor: Actor) {
  const subs = ['secrets', 'history', 'requests'] as const
  for (const sub of subs) {
    const snap = await getDocs(collection(db, 'apps', app.id, sub))
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = writeBatch(db)
      snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref))
      await b.commit()
    }
  }
  await deleteDoc(doc(db, 'apps', app.id))
  await logAudit(actor, 'app_delete', { appId: app.id, appName: app.name })
}

export function subscribeHistory(appId: string, cb: (rows: HistoryEntry[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'apps', appId, 'history'), orderBy('at', 'desc'), limit(200)),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<HistoryEntry, 'id'>) }))),
    onErr,
  )
}

/* ---------- Pedidos (alterações, updates, novos módulos, bugs) ---------- */

/** Todos os pedidos de todas as apps (para contagens e listas). Qualquer utilizador ativo lê. */
export function subscribeRequestsIndex(cb: (rows: AppRequest[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    collectionGroup(db, 'requests'),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppRequest, 'id'>) }))),
    onErr,
  )
}

export type RequestInput = Omit<AppRequest, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> & { id?: string }

export async function saveRequest(input: RequestInput, actor: Actor) {
  const { id, ...data } = input
  const clean = { ...data, title: data.title.trim(), description: data.description.trim(), updatedAt: serverTimestamp(), updatedBy: actor.email }
  if (id) {
    await updateDoc(doc(db, 'apps', input.appId, 'requests', id), clean)
    await addHistory(input.appId, actor, 'request', `Atualizou o pedido “${clean.title}”`)
  } else {
    await addDoc(collection(db, 'apps', input.appId, 'requests'), { ...clean, createdAt: serverTimestamp(), createdBy: actor.email })
    await addHistory(input.appId, actor, 'request', `Registou o pedido “${clean.title}”`)
  }
}

export async function setRequestStatus(r: AppRequest, status: AppRequest['status'], label: string, actor: Actor) {
  if (r.status === status) return
  await updateDoc(doc(db, 'apps', r.appId, 'requests', r.id), { status, updatedAt: serverTimestamp(), updatedBy: actor.email })
  await addHistory(r.appId, actor, 'request', `Pedido “${r.title}”: ${label}`)
}

export async function deleteRequest(r: AppRequest, actor: Actor) {
  await deleteDoc(doc(db, 'apps', r.appId, 'requests', r.id))
  await addHistory(r.appId, actor, 'request', `Apagou o pedido “${r.title}”`)
}

/* ---------- Secrets ---------- */

const toSecret = (id: string, data: Record<string, unknown>) => ({ id, ...(data as Omit<SecretDoc, 'id'>) })

/** Índice de todos os secrets (só metadados úteis: nome, app, ambiente, rotação). Só Editors e Admins. */
export function subscribeSecretsIndex(cb: (rows: SecretDoc[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    collectionGroup(db, 'secrets'),
    (s) => cb(s.docs.map((d) => toSecret(d.id, d.data()))),
    onErr,
  )
}

export interface SecretInput {
  id?: string
  appId: string
  env: EnvKey
  name: string
  type: SecretType
  note: string
  rotateBy: string
  /** undefined = manter o valor atual (só metadados mudam) */
  value?: string
}

export async function saveSecret(input: SecretInput, vaultKey: CryptoKey, version: number, actor: Actor, appName: string) {
  const col = collection(db, 'apps', input.appId, 'secrets')
  const ref = input.id ? doc(col, input.id) : doc(col)
  const meta = {
    appId: input.appId,
    env: input.env,
    name: input.name.trim(),
    type: input.type,
    note: input.note.trim(),
    rotateBy: input.rotateBy,
    updatedAt: serverTimestamp(),
    updatedBy: actor.email,
  }
  if (input.value !== undefined) {
    const blob = await encryptString(vaultKey, input.value, secretAad(input.appId, ref.id))
    Object.assign(meta, { ...blob, version })
  }
  if (input.id) {
    await updateDoc(ref, meta)
  } else {
    await setDoc(ref, { ...meta, createdAt: serverTimestamp(), createdBy: actor.email })
  }
  await logAudit(actor, input.id ? 'secret_update' : 'secret_create', {
    appId: input.appId,
    appName,
    env: input.env,
    target: meta.name,
    detail: input.value !== undefined ? 'valor definido' : 'só metadados',
  })
  await addHistory(input.appId, actor, 'secret', `${input.id ? 'Atualizou' : 'Criou'} o secret ${meta.name} (${input.env.toUpperCase()})`)
}

export async function deleteSecret(secret: SecretDoc, actor: Actor, appName: string) {
  await deleteDoc(doc(db, 'apps', secret.appId, 'secrets', secret.id))
  await logAudit(actor, 'secret_delete', { appId: secret.appId, appName, env: secret.env, target: secret.name })
  await addHistory(secret.appId, actor, 'secret', `Apagou o secret ${secret.name} (${secret.env.toUpperCase()})`)
}

export async function revealSecret(secret: SecretDoc, vaultKey: CryptoKey): Promise<string> {
  return decryptString(vaultKey, { iv: secret.iv, ct: secret.ct }, secretAad(secret.appId, secret.id))
}

/* ---------- Utilizadores ---------- */

export function subscribeUser(email: string, cb: (u: UserProfile | null) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', email),
    (d) => cb(d.exists() ? (d.data() as UserProfile) : null),
    onErr,
  )
}

export function subscribeUsers(cb: (rows: UserProfile[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(collection(db, 'users'), (s) => cb(s.docs.map((d) => d.data() as UserProfile)), onErr)
}

export async function bootstrapAdmin(email: string, name: string) {
  await setDoc(doc(db, 'users', email), {
    email,
    displayName: name,
    role: 'admin',
    active: true,
    createdAt: serverTimestamp(),
    createdBy: email,
    lastLoginAt: serverTimestamp(),
  })
}

export async function touchLogin(email: string, name: string) {
  await updateDoc(doc(db, 'users', email), { lastLoginAt: serverTimestamp(), displayName: name })
}

export async function upsertUser(u: { email: string; displayName: string; role: Role; active: boolean }, actor: Actor, isNew: boolean) {
  const ref = doc(db, 'users', u.email)
  if (isNew) {
    await setDoc(ref, { ...u, createdAt: serverTimestamp(), createdBy: actor.email, lastLoginAt: null })
    await logAudit(actor, 'user_create', { target: u.email, detail: u.role })
  } else {
    await updateDoc(ref, { displayName: u.displayName, role: u.role, active: u.active })
    await logAudit(actor, 'user_update', { target: u.email, detail: `${u.role}${u.active ? '' : ', inativo'}` })
  }
}

/* ---------- Chaves pessoais ---------- */

export function subscribeUserKeys(email: string, cb: (k: UserKeys | null) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    doc(db, 'userKeys', email),
    (d) => cb(d.exists() ? (d.data() as UserKeys) : null),
    onErr,
  )
}

export function subscribeAllUserKeys(cb: (rows: UserKeys[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(collection(db, 'userKeys'), (s) => cb(s.docs.map((d) => d.data() as UserKeys)), onErr)
}

export async function saveMyKeys(email: string, keys: Omit<UserKeys, 'email' | 'createdAt'>, actor: Actor) {
  await setDoc(doc(db, 'userKeys', email), { ...keys, email, createdAt: serverTimestamp() })
  await logAudit(actor, 'keys_create', { target: email })
}

/** Apaga as chaves de alguém (o próprio, ou um Admin) e o acesso ao cofre que dependia delas. */
export async function resetKeys(email: string, actor: Actor) {
  const b = writeBatch(db)
  b.delete(doc(db, 'vaultGrants', email))
  b.delete(doc(db, 'userKeys', email))
  await b.commit()
  await logAudit(actor, 'keys_reset', { target: email })
}

/* ---------- Cofre ---------- */

export function subscribeVaultMeta(cb: (m: VaultMeta | null) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    doc(db, 'vault', 'meta'),
    (d) => cb(d.exists() ? (d.data() as VaultMeta) : null),
    onErr,
  )
}

export function subscribeGrant(email: string, cb: (g: VaultGrant | null) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    doc(db, 'vaultGrants', email),
    (d) => cb(d.exists() ? (d.data() as VaultGrant) : null),
    onErr,
  )
}

export function subscribeGrants(cb: (rows: VaultGrant[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(collection(db, 'vaultGrants'), (s) => cb(s.docs.map((d) => d.data() as VaultGrant)), onErr)
}

/** Cria a chave do cofre e dá acesso ao próprio Admin. Devolve a chave para ficar desbloqueado. */
export async function initVault(actor: Actor, myPublicKey: string): Promise<CryptoKey> {
  const key = await generateVaultKey()
  const check = await makeVaultCheck(key)
  const wrapped = await wrapVaultKey(key, myPublicKey)
  const b = writeBatch(db)
  b.set(doc(db, 'vault', 'meta'), { version: 1, check, createdAt: serverTimestamp(), createdBy: actor.email })
  b.set(doc(db, 'vaultGrants', actor.email), { email: actor.email, wrappedKey: wrapped, version: 1, grantedBy: actor.email, grantedAt: serverTimestamp() })
  await b.commit()
  await logAudit(actor, 'vault_init')
  return key
}

export async function grantVault(target: UserKeys, vaultKey: CryptoKey, version: number, actor: Actor) {
  const wrapped = await wrapVaultKey(vaultKey, target.publicKey)
  await setDoc(doc(db, 'vaultGrants', target.email), {
    email: target.email,
    wrappedKey: wrapped,
    version,
    grantedBy: actor.email,
    grantedAt: serverTimestamp(),
  })
  await logAudit(actor, 'vault_grant', { target: target.email, detail: `chave ${target.fingerprint}` })
}

export async function revokeVault(email: string, actor: Actor) {
  await deleteDoc(doc(db, 'vaultGrants', email))
  await logAudit(actor, 'vault_revoke', { target: email })
}

/**
 * Roda a chave do cofre: decifra todos os secrets com a chave atual, cifra com uma nova,
 * e volta a embrulhar a nova chave para quem tem acesso (exceto quem se quer excluir).
 * Tudo vai num único batch atómico.
 */
export async function rotateVault(
  oldKey: CryptoKey,
  oldVersion: number,
  grants: VaultGrant[],
  keys: UserKeys[],
  actor: Actor,
  onProgress?: (msg: string) => void,
): Promise<CryptoKey> {
  onProgress?.('A ler secrets…')
  const snap = await getDocs(collectionGroup(db, 'secrets'))
  const newKey = await generateVaultKey()
  const newVersion = oldVersion + 1
  type Op = { ref: (typeof snap.docs)[number]['ref']; data: Record<string, unknown> }
  const ops: Op[] = []
  let i = 0
  for (const d of snap.docs) {
    const s = toSecret(d.id, d.data())
    const aad = secretAad(s.appId, s.id)
    const plain = await decryptString(oldKey, { iv: s.iv, ct: s.ct }, aad)
    const blob = await encryptString(newKey, plain, aad)
    ops.push({ ref: d.ref, data: { ...blob, version: newVersion } })
    onProgress?.(`A cifrar de novo ${++i} de ${snap.size}…`)
  }
  const keyByEmail = new Map(keys.map((k) => [k.email, k]))
  const grantOps: { email: string; wrapped: string }[] = []
  for (const g of grants) {
    const k = keyByEmail.get(g.email)
    if (!k) continue
    grantOps.push({ email: g.email, wrapped: await wrapVaultKey(newKey, k.publicKey) })
  }
  const check = await makeVaultCheck(newKey)
  // Tem de ser um único batch (atómico): ou tudo passa para a chave nova, ou nada muda.
  // Um batch do Firestore aceita até 500 escritas.
  if (ops.length + grantOps.length + 1 > 500) {
    throw new Error(`Há ${ops.length} secrets e ${grantOps.length} acessos; a rotação atómica suporta até 500 escritas no total.`)
  }
  onProgress?.('A gravar…')
  const b = writeBatch(db)
  ops.forEach((o) => b.update(o.ref, o.data))
  for (const g of grantOps) {
    b.set(doc(db, 'vaultGrants', g.email), { email: g.email, wrappedKey: g.wrapped, version: newVersion, grantedBy: actor.email, grantedAt: serverTimestamp() })
  }
  b.update(doc(db, 'vault', 'meta'), { version: newVersion, check, rotatedAt: serverTimestamp(), rotatedBy: actor.email })
  await b.commit()
  await logAudit(actor, 'vault_rotate', { detail: `versão ${newVersion}, ${ops.length} secrets, ${grantOps.length} acessos` })
  return newKey
}

/* ---------- utilitários ---------- */

function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}
