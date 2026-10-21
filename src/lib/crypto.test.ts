import { describe, expect, it } from 'vitest'
import {
  createUserKeys,
  decryptString,
  encryptString,
  generateVaultKey,
  makeVaultCheck,
  openPrivateKey,
  secretAad,
  unwrapVaultKey,
  verifyVaultCheck,
  wrapVaultKey,
  WrongPassphraseError,
} from './crypto'

// iterações baixas só nos testes, para correr depressa
const IT = 1000

describe('cofre', () => {
  it('fluxo completo: chaves pessoais, embrulhar, desembrulhar, cifrar', async () => {
    const admin = await createUserKeys('frase do admin bem comprida', IT)
    const dev = await createUserKeys('frase do dev bem comprida', IT)
    expect(admin.fingerprint).toMatch(/^[0-9A-F]{4}( [0-9A-F]{4}){3}$/)

    const vault = await generateVaultKey()
    const check = await makeVaultCheck(vault)
    const grantForDev = await wrapVaultKey(vault, dev.publicKey)

    // o dev abre a sua privada com a passphrase e desembrulha a chave do cofre
    const devPriv = await openPrivateKey(dev.encPrivateKey, 'frase do dev bem comprida')
    const devVault = await unwrapVaultKey(grantForDev, devPriv)
    expect(await verifyVaultCheck(devVault, check)).toBe(true)

    const aad = secretAad('app1', 's1')
    const blob = await encryptString(vault, 'sk-segredo-123', aad)
    expect(blob.ct).not.toContain('segredo')
    expect(await decryptString(devVault, blob, aad)).toBe('sk-segredo-123')

    // AAD diferente (documento trocado) falha
    await expect(decryptString(devVault, blob, secretAad('app1', 'outro'))).rejects.toBeTruthy()

    // o admin não consegue usar o grant do dev
    await expect(unwrapVaultKey(grantForDev, admin.privateKey)).rejects.toBeTruthy()
  })

  it('passphrase errada é detetada', async () => {
    const k = await createUserKeys('passphrase correta 123', IT)
    await expect(openPrivateKey(k.encPrivateKey, 'passphrase errada 123')).rejects.toBeInstanceOf(WrongPassphraseError)
  })

  it('verificação falha com outra chave', async () => {
    const a = await generateVaultKey()
    const b = await generateVaultKey()
    expect(await verifyVaultCheck(b, await makeVaultCheck(a))).toBe(false)
  })
})
