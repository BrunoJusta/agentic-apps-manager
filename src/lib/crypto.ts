/**
 * Criptografia do cofre. Tudo corre no browser com WebCrypto; o Firestore só vê texto cifrado.
 *
 * Modelo:
 *  - Cada utilizador tem um par RSA-OAEP 3072 (SHA-256). A chave privada é cifrada com
 *    AES-256-GCM, com chave derivada da passphrase pessoal por PBKDF2-SHA256 (600 000 iterações).
 *  - Existe uma chave do cofre (AES-256-GCM) global. Para cada pessoa com acesso, essa chave é
 *    "embrulhada" (wrapKey) com a chave pública dela e guardada em vaultGrants/{email}.
 *  - Cada secret é cifrado com a chave do cofre, IV aleatório de 96 bits e AAD igual ao caminho
 *    do documento, para que não se possa trocar texto cifrado entre documentos.
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

export const PBKDF2_ITERATIONS = 600_000
const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 3072,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}
const VAULT_CHECK_PLAINTEXT = 'agentic-apps-manager:vault-check:v1'
const VAULT_CHECK_AAD = 'vault/meta'

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function random(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)))
}

async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function fingerprint(publicKeyB64: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', fromB64(publicKeyB64))
  const hex = Array.from(new Uint8Array(hash).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.match(/.{4}/g)!.join(' ').toUpperCase()
}

export interface CreatedUserKeys {
  publicKey: string
  fingerprint: string
  encPrivateKey: { salt: string; iv: string; ct: string; iterations: number }
  privateKey: CryptoKey
}

/** Gera o par de chaves pessoal e cifra a privada com a passphrase. */
export async function createUserKeys(passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<CreatedUserKeys> {
  const pair = (await crypto.subtle.generateKey(RSA_PARAMS, true, ['wrapKey', 'unwrapKey'])) as CryptoKeyPair
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  const salt = random(16)
  const iv = random(12)
  const kek = await deriveKeyFromPassphrase(passphrase, salt, iterations)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, pkcs8)
  const publicKey = toB64(spki)
  // Reimporta a privada como não-extraível para uso em memória.
  const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['unwrapKey'])
  return {
    publicKey,
    fingerprint: await fingerprint(publicKey),
    encPrivateKey: { salt: toB64(salt), iv: toB64(iv), ct: toB64(ct), iterations },
    privateKey,
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('Passphrase incorreta')
  }
}

/** Abre a chave privada com a passphrase. Lança WrongPassphraseError se não bater certo. */
export async function openPrivateKey(enc: { salt: string; iv: string; ct: string; iterations: number }, passphrase: string): Promise<CryptoKey> {
  const kek = await deriveKeyFromPassphrase(passphrase, fromB64(enc.salt), enc.iterations)
  let pkcs8: ArrayBuffer
  try {
    pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(enc.iv) }, kek, fromB64(enc.ct))
  } catch {
    throw new WrongPassphraseError()
  }
  return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['unwrapKey'])
}

/** Chave do cofre. Fica extraível em memória porque é preciso embrulhá-la para dar acesso a outros. */
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function wrapVaultKey(vaultKey: CryptoKey, recipientPublicKeyB64: string): Promise<string> {
  const pub = await crypto.subtle.importKey('spki', fromB64(recipientPublicKeyB64), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['wrapKey'])
  const wrapped = await crypto.subtle.wrapKey('raw', vaultKey, pub, { name: 'RSA-OAEP' })
  return toB64(wrapped)
}

export async function unwrapVaultKey(wrappedB64: string, privateKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey('raw', fromB64(wrappedB64), privateKey, { name: 'RSA-OAEP' }, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

export async function encryptString(key: CryptoKey, plaintext: string, aad: string): Promise<{ iv: string; ct: string }> {
  const iv = random(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(plaintext))
  return { iv: toB64(iv), ct: toB64(ct) }
}

export async function decryptString(key: CryptoKey, blob: { iv: string; ct: string }, aad: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(blob.iv), additionalData: enc.encode(aad) }, key, fromB64(blob.ct))
  return dec.decode(pt)
}

export async function makeVaultCheck(key: CryptoKey) {
  return encryptString(key, VAULT_CHECK_PLAINTEXT, VAULT_CHECK_AAD)
}

export async function verifyVaultCheck(key: CryptoKey, check: { iv: string; ct: string }): Promise<boolean> {
  try {
    return (await decryptString(key, check, VAULT_CHECK_AAD)) === VAULT_CHECK_PLAINTEXT
  } catch {
    return false
  }
}

/** AAD de um secret: o caminho do documento. */
export const secretAad = (appId: string, secretId: string) => `apps/${appId}/secrets/${secretId}`
/** AAD dos itens do cofre: o valor fica preso ao documento onde foi gravado. */
export const vaultItemAad = (itemId: string) => `vaultItems/${itemId}`

/** Regras mínimas de passphrase: 12+ caracteres. */
export function passphraseProblems(p: string): string | null {
  if (p.length < 12) return 'Usa pelo menos 12 caracteres. Uma frase com 4 ou 5 palavras funciona bem.'
  if (/^(.)\1+$/.test(p)) return 'Evita repetir o mesmo caractere.'
  return null
}
