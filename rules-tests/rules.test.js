// Testes das firestore.rules contra o emulador.
// Correr: cd rules-tests && npm install && npm test   (precisa de Java 11+ instalado)
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collectionGroup, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

const DB = 'agentic-apps-prod'
let env

const users = {
  'bruno.justa@sogrape.pt': { role: 'admin', active: true },
  'editor@sogrape.pt': { role: 'editor', active: true },
  'viewer@sogrape.pt': { role: 'viewer', active: true },
  'inativo@sogrape.pt': { role: 'editor', active: false },
}

const as = (email) => env.authenticatedContext(email.split('@')[0], { email }).firestore({ databaseId: DB })
const anon = () => env.unauthenticatedContext().firestore({ databaseId: DB })

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-agentic-apps',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  })
})
afterAll(() => env?.cleanup())

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore({ databaseId: DB })
    for (const [email, u] of Object.entries(users)) await setDoc(doc(db, 'users', email), { email, displayName: email, ...u })
    await setDoc(doc(db, 'apps', 'a1'), { name: 'App 1' })
    await setDoc(doc(db, 'apps', 'a1', 'secrets', 's1'), { appId: 'a1', env: 'prod', name: 'KEY', type: 'api_key', note: '', rotateBy: '', iv: 'x', ct: 'y', version: 1 })
    await setDoc(doc(db, 'vault', 'meta'), { version: 1, check: { iv: 'a', ct: 'b' } })
  })
})

const secret = (extra = {}) => ({ appId: 'a1', env: 'dev', name: 'NEW', type: 'other', note: '', rotateBy: '', iv: 'i', ct: 'c', version: 1, ...extra })

describe('acesso geral', () => {
  it('anónimo e contas de fora não leem nada', async () => {
    await assertFails(getDoc(doc(anon(), 'apps', 'a1')))
    await assertFails(getDoc(doc(as('alguem@gmail.com'), 'apps', 'a1')))
    await assertFails(getDoc(doc(as('naoautorizado@sogrape.pt'), 'apps', 'a1')))
    await assertFails(getDoc(doc(as('inativo@sogrape.pt'), 'apps', 'a1')))
  })
  it('viewer lê apps mas não escreve', async () => {
    const db = as('viewer@sogrape.pt')
    await assertSucceeds(getDoc(doc(db, 'apps', 'a1')))
    await assertFails(updateDoc(doc(db, 'apps', 'a1'), { name: 'X' }))
  })
  it('editor escreve apps, só admin apaga', async () => {
    await assertSucceeds(updateDoc(doc(as('editor@sogrape.pt'), 'apps', 'a1'), { name: 'X' }))
    await assertFails(deleteDoc(doc(as('editor@sogrape.pt'), 'apps', 'a1')))
    await assertSucceeds(deleteDoc(doc(as('bruno.justa@sogrape.pt'), 'apps', 'a1')))
  })
})

describe('secrets', () => {
  it('viewer não lê secrets, nem por collection group', async () => {
    const db = as('viewer@sogrape.pt')
    await assertFails(getDoc(doc(db, 'apps', 'a1', 'secrets', 's1')))
    await assertFails(getDocs(collectionGroup(db, 'secrets')))
  })
  it('editor lê e escreve secrets cifrados', async () => {
    const db = as('editor@sogrape.pt')
    await assertSucceeds(getDocs(collectionGroup(db, 'secrets')))
    await assertSucceeds(setDoc(doc(db, 'apps', 'a1', 'secrets', 's2'), secret()))
  })
  it('recusa um campo value em claro', async () => {
    await assertFails(setDoc(doc(as('editor@sogrape.pt'), 'apps', 'a1', 'secrets', 's3'), secret({ value: 'plain' })))
  })
  it('recusa appId trocado', async () => {
    await assertFails(setDoc(doc(as('editor@sogrape.pt'), 'apps', 'a1', 'secrets', 's4'), secret({ appId: 'outra' })))
  })
})

describe('utilizadores', () => {
  it('só admin dá acesso, e só a @sogrape.pt', async () => {
    await assertFails(setDoc(doc(as('editor@sogrape.pt'), 'users', 'novo@sogrape.pt'), { email: 'novo@sogrape.pt', role: 'viewer', active: true }))
    await assertSucceeds(setDoc(doc(as('bruno.justa@sogrape.pt'), 'users', 'novo@sogrape.pt'), { email: 'novo@sogrape.pt', role: 'viewer', active: true }))
    await assertFails(setDoc(doc(as('bruno.justa@sogrape.pt'), 'users', 'x@gmail.com'), { email: 'x@gmail.com', role: 'viewer', active: true }))
  })
  it('ninguém se promove a si próprio', async () => {
    await assertFails(updateDoc(doc(as('editor@sogrape.pt'), 'users', 'editor@sogrape.pt'), { role: 'admin' }))
    await assertSucceeds(updateDoc(doc(as('editor@sogrape.pt'), 'users', 'editor@sogrape.pt'), { lastLoginAt: serverTimestamp() }))
  })
  it('o admin de arranque não pode ser despromovido', async () => {
    await assertFails(updateDoc(doc(as('bruno.justa@sogrape.pt'), 'users', 'bruno.justa@sogrape.pt'), { role: 'viewer' }))
  })
})

describe('cofre', () => {
  it('admin dá acesso só a editors/admins ativos', async () => {
    const db = as('bruno.justa@sogrape.pt')
    const grant = (email) => ({ email, wrappedKey: 'w', version: 1, grantedBy: 'bruno.justa@sogrape.pt' })
    await assertSucceeds(setDoc(doc(db, 'vaultGrants', 'editor@sogrape.pt'), grant('editor@sogrape.pt')))
    await assertFails(setDoc(doc(db, 'vaultGrants', 'viewer@sogrape.pt'), grant('viewer@sogrape.pt')))
    await assertFails(setDoc(doc(db, 'vaultGrants', 'inativo@sogrape.pt'), grant('inativo@sogrape.pt')))
  })
  it('editor não dá acesso a ninguém nem lê grants alheios', async () => {
    const db = as('editor@sogrape.pt')
    await assertFails(setDoc(doc(db, 'vaultGrants', 'editor@sogrape.pt'), { email: 'editor@sogrape.pt', wrappedKey: 'w', version: 1 }))
    await assertFails(getDoc(doc(db, 'vaultGrants', 'bruno.justa@sogrape.pt')))
  })
  it('a versão da chave só avança de 1 em 1, e só por admin', async () => {
    await assertFails(updateDoc(doc(as('editor@sogrape.pt'), 'vault', 'meta'), { version: 2 }))
    await assertFails(updateDoc(doc(as('bruno.justa@sogrape.pt'), 'vault', 'meta'), { version: 5 }))
    await assertSucceeds(updateDoc(doc(as('bruno.justa@sogrape.pt'), 'vault', 'meta'), { version: 2 }))
  })
})

describe('auditoria', () => {
  it('cada um regista em seu nome, ninguém apaga, só admin lê', async () => {
    const ed = as('editor@sogrape.pt')
    await assertSucceeds(setDoc(doc(ed, 'audit', 'e1'), { by: 'editor@sogrape.pt', action: 'reveal', at: serverTimestamp() }))
    await assertFails(setDoc(doc(ed, 'audit', 'e2'), { by: 'bruno.justa@sogrape.pt', action: 'reveal', at: serverTimestamp() }))
    await assertFails(getDoc(doc(ed, 'audit', 'e1')))
    await assertSucceeds(getDoc(doc(as('bruno.justa@sogrape.pt'), 'audit', 'e1')))
    await assertFails(deleteDoc(doc(as('bruno.justa@sogrape.pt'), 'audit', 'e1')))
  })
})
