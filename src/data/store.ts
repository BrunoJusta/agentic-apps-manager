import {
  addDoc,
  arrayRemove,
  arrayUnion,
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
  vaultItemAad,
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
  VaultItem,
  VaultItemKind,
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

/** Secrets no formato antigo (dentro de cada app). Só servem para a migração para o cofre. */
export function subscribeSecretsIndex(cb: (rows: SecretDoc[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    collectionGroup(db, 'secrets'),
    (s) => cb(s.docs.map((d) => toSecret(d.id, d.data()))),
    onErr,
  )
}

/* ---------- Itens do cofre (variáveis e secrets partilhados) ---------- */

const toItem = (id: string, data: Record<string, unknown>): VaultItem => ({
  id,
  name: String(data.name ?? ''),
  kind: data.kind === 'variable' ? 'variable' : 'secret',
  type: (data.type as SecretType) ?? 'other',
  note: String(data.note ?? ''),
  rotateBy: String(data.rotateBy ?? ''),
  iv: String(data.iv ?? ''),
  ct: String(data.ct ?? ''),
  version: typeof data.version === 'number' ? data.version : 0,
  createdAt: (data.createdAt as VaultItem['createdAt']) ?? null,
  createdBy: data.createdBy as string | undefined,
  updatedAt: (data.updatedAt as VaultItem['updatedAt']) ?? null,
  updatedBy: data.updatedBy as string | undefined,
})

/** Todos os itens do cofre (nomes e metadados; valores cifrados). Só Editors e Admins. */
export function subscribeVaultItems(cb: (rows: VaultItem[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(collection(db, 'vaultItems'), (s) => cb(s.docs.map((d) => toItem(d.id, d.data()))), onErr)
}

export interface VaultItemInput {
  id?: string
  name: string
  kind: VaultItemKind
  type: SecretType
  note: string
  rotateBy: string
  /** undefined = manter o valor atual (só metadados mudam) */
  value?: string
}

/** Cria ou atualiza um item do cofre. Devolve o id. */
export async function saveVaultItem(input: VaultItemInput, vaultKey: CryptoKey, version: number, actor: Actor): Promise<string> {
  const ref = input.id ? doc(db, 'vaultItems', input.id) : doc(collection(db, 'vaultItems'))
  const meta: Record<string, unknown> = {
    name: input.name.trim(),
    kind: input.kind,
    type: input.kind === 'variable' ? 'other' : input.type,
    note: input.note.trim(),
    rotateBy: input.kind === 'variable' ? '' : input.rotateBy,
    updatedAt: serverTimestamp(),
    updatedBy: actor.email,
  }
  if (input.value !== undefined) {
    Object.assign(meta, await encryptString(vaultKey, input.value, vaultItemAad(ref.id)), { version })
  }
  if (input.id) await updateDoc(ref, meta)
  else await setDoc(ref, { ...meta, createdAt: serverTimestamp(), createdBy: actor.email })
  await logAudit(actor, input.id ? 'secret_update' : 'secret_create', {
    target: String(meta.name),
    detail: `${input.kind === 'variable' ? 'variável' : 'secret'}, ${input.value !== undefined ? 'valor definido' : 'só metadados'}`,
  })
  return ref.id
}

/** Apaga o item e tira-o de todas as apps onde estava ligado, numa só escrita. */
export async function deleteVaultItem(item: VaultItem, apps: AgenticApp[], actor: Actor) {
  const b = writeBatch(db)
  b.delete(doc(db, 'vaultItems', item.id))
  const touched: { app: AgenticApp; env: EnvKey }[] = []
  for (const app of apps) {
    for (const env of ['dev', 'qa', 'prod'] as EnvKey[]) {
      if (app.environments[env].vaultRefs.includes(item.id)) {
        b.update(doc(db, 'apps', app.id), { [`environments.${env}.vaultRefs`]: arrayRemove(item.id) })
        touched.push({ app, env })
      }
    }
  }
  await b.commit()
  await logAudit(actor, 'secret_delete', { target: item.name, detail: `${item.kind === 'variable' ? 'variável' : 'secret'}, tirado de ${touched.length} ambiente(s)` })
  for (const t of touched) await addHistory(t.app.id, actor, 'vault', `${item.name} foi apagado do cofre e saiu de ${t.env.toUpperCase()}`)
}

export async function revealVaultItem(item: VaultItem, vaultKey: CryptoKey): Promise<string> {
  return decryptString(vaultKey, { iv: item.iv, ct: item.ct }, vaultItemAad(item.id))
}

/** Liga itens do cofre a um ambiente de uma app (só guarda os ids). */
export async function linkVaultItems(app: AgenticApp, env: EnvKey, items: VaultItem[], actor: Actor) {
  if (!items.length) return
  await updateDoc(doc(db, 'apps', app.id), {
    [`environments.${env}.vaultRefs`]: arrayUnion(...items.map((i) => i.id)),
    updatedAt: serverTimestamp(),
    updatedBy: actor.email,
  })
  await logAudit(actor, 'vault_link', { appId: app.id, appName: app.name, env, target: items.map((i) => i.name).join(', ') })
  await addHistory(app.id, actor, 'vault', `Ligou ${items.map((i) => i.name).join(', ')} do cofre (${env.toUpperCase()})`)
}

export async function unlinkVaultItem(app: AgenticApp, env: EnvKey, item: { id: string; name: string }, actor: Actor) {
  await updateDoc(doc(db, 'apps', app.id), {
    [`environments.${env}.vaultRefs`]: arrayRemove(item.id),
    updatedAt: serverTimestamp(),
    updatedBy: actor.email,
  })
  await logAudit(actor, 'vault_unlink', { appId: app.id, appName: app.name, env, target: item.name })
  await addHistory(app.id, actor, 'vault', `Desligou ${item.name} (${env.toUpperCase()}). O item continua no cofre.`)
}

/**
 * Migra o modelo antigo (secrets dentro de cada app e variáveis em texto simples)
 * para itens do cofre ligados às mesmas apps e ambientes. Uma escrita atómica por app.
 */
export async function migrateLegacyToVault(apps: AgenticApp[], legacy: SecretDoc[], vaultKey: CryptoKey, version: number, actor: Actor, onProgress?: (msg: string) => void) {
  let nItems = 0
  const ids = new Set([...apps.filter((a) => (['dev', 'qa', 'prod'] as EnvKey[]).some((e) => a.environments[e].variables.length)).map((a) => a.id), ...legacy.map((s) => s.appId)])
  let done = 0
  for (const appId of ids) {
    const app = apps.find((a) => a.id === appId)
    onProgress?.(`A migrar ${++done} de ${ids.size}…`)
    const b = writeBatch(db)
    const refs: Record<EnvKey, string[]> = { dev: [], qa: [], prod: [] }
    const add = async (env: EnvKey, data: { name: string; kind: VaultItemKind; type: SecretType; note: string; rotateBy: string; value: string }) => {
      const ref = doc(collection(db, 'vaultItems'))
      const blob = await encryptString(vaultKey, data.value, vaultItemAad(ref.id))
      const { value: _v, ...meta } = data
      b.set(ref, { ...meta, ...blob, version, createdAt: serverTimestamp(), createdBy: actor.email, updatedAt: serverTimestamp(), updatedBy: actor.email })
      refs[env].push(ref.id)
      nItems++
    }
    const where = (env: EnvKey) => `${app?.name ?? 'app apagada'} (${env.toUpperCase()})`
    for (const s of legacy.filter((x) => x.appId === appId)) {
      const value = await decryptString(vaultKey, { iv: s.iv, ct: s.ct }, secretAad(s.appId, s.id))
      await add(s.env, { name: s.name, kind: 'secret', type: s.type ?? 'other', note: s.note || `Migrado de ${where(s.env)}`, rotateBy: s.rotateBy ?? '', value })
      b.delete(doc(db, 'apps', s.appId, 'secrets', s.id))
    }
    if (app) {
      const upd: Record<string, unknown> = { updatedAt: serverTimestamp(), updatedBy: actor.email }
      for (const env of ['dev', 'qa', 'prod'] as EnvKey[]) {
        for (const v of app.environments[env].variables) {
          await add(env, { name: v.key, kind: 'variable', type: 'other', note: v.note || `Migrado de ${where(env)}`, rotateBy: '', value: v.value })
        }
        if (refs[env].length) upd[`environments.${env}.vaultRefs`] = arrayUnion(...refs[env])
        if (app.environments[env].variables.length) upd[`environments.${env}.variables`] = []
      }
      b.update(doc(db, 'apps', app.id), upd)
    }
    await b.commit()
    if (app) await addHistory(app.id, actor, 'vault', 'Variáveis e secrets passaram para o cofre (migração)')
  }
  await logAudit(actor, 'vault_migrate', { detail: `${nItems} itens, ${ids.size} apps` })
  return nItems
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
  onProgress?.('A ler o cofre…')
  const legacy = await getDocs(collectionGroup(db, 'secrets'))
  if (!legacy.empty) throw new Error(`Ainda há ${legacy.size} secrets no formato antigo. Migra-os no Cofre antes de rodar a chave.`)
  const snap = await getDocs(collection(db, 'vaultItems'))
  const newKey = await generateVaultKey()
  const newVersion = oldVersion + 1
  type Op = { ref: (typeof snap.docs)[number]['ref']; data: Record<string, unknown> }
  const ops: Op[] = []
  let i = 0
  for (const d of snap.docs) {
    const s = toItem(d.id, d.data())
    const aad = vaultItemAad(s.id)
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
    throw new Error(`Há ${ops.length} itens no cofre e ${grantOps.length} acessos; a rotação atómica suporta até 500 escritas no total.`)
  }
  onProgress?.('A gravar…')
  const b = writeBatch(db)
  ops.forEach((o) => b.update(o.ref, o.data))
  for (const g of grantOps) {
    b.set(doc(db, 'vaultGrants', g.email), { email: g.email, wrappedKey: g.wrapped, version: newVersion, grantedBy: actor.email, grantedAt: serverTimestamp() })
  }
  b.update(doc(db, 'vault', 'meta'), { version: newVersion, check, rotatedAt: serverTimestamp(), rotatedBy: actor.email })
  await b.commit()
  await logAudit(actor, 'vault_rotate', { detail: `versão ${newVersion}, ${ops.length} itens, ${grantOps.length} acessos` })
  return newKey
}

/* ---------- utilitários ---------- */

function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}
