import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { ArrowsClockwise, Fingerprint, Key, LockKey, ShieldCheck, UserPlus, Users } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { ALLOWED_DOMAIN, BOOTSTRAP_ADMIN, ROLES } from '../lib/constants'
import { fmtDateTime, fmtRelative } from '../lib/format'
import { grantVault, resetKeys, revokeVault, rotateVault, subscribeAllUserKeys, subscribeGrants, subscribeUsers, upsertUser } from '../data/store'
import type { Role, UserKeys, UserProfile, VaultGrant } from '../lib/types'
import { PageHeader } from '../components/Layout'
import { Avatar, Button, ConfirmDialog, Dialog, EmptyState, Field, Input, Panel, Select, Skeleton, StatusPill } from '../components/ui'
import { UnlockDialog } from '../components/VaultGate'

function AddUserDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing: string[] }) {
  const { actor } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setEmail('')
      setName('')
      setRole('viewer')
      setErr(null)
    }
  }, [open])
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dar acesso a uma pessoa"
      description={`A pessoa entra com a conta Microsoft. Só emails ${ALLOWED_DOMAIN}.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="add-user" loading={busy}>
            Dar acesso
          </Button>
        </>
      }
    >
      <form
        id="add-user"
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const em = email.trim().toLowerCase()
          if (!em.endsWith(ALLOWED_DOMAIN) || !/^[^\s@]+@[^\s@]+$/.test(em)) return setErr(`Tem de ser um email ${ALLOWED_DOMAIN}.`)
          if (existing.includes(em)) return setErr('Esta pessoa já tem acesso. Muda o papel na lista.')
          setBusy(true)
          try {
            await upsertUser({ email: em, displayName: name.trim() || em.split('@')[0], role, active: true }, actor, true)
            toast(`${em} já pode entrar.`)
            onClose()
          } catch (e2) {
            setErr((e2 as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field label="Email" htmlFor="u-email" error={err}>
          <Input id="u-email" type="email" inputMode="email" autoComplete="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`nome${ALLOWED_DOMAIN}`} aria-invalid={!!err} />
        </Field>
        <Field label="Nome" htmlFor="u-name">
          <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Papel" htmlFor="u-role" hint={ROLES.find((r) => r.key === role)?.hint}>
          <Select id="u-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Dialog>
  )
}

export function UsersPage() {
  const { actor, email: me } = useAuth()
  const vault = useVault()
  const toast = useToast()
  const [users, setUsers] = useState<UserProfile[] | null>(null)
  const [keys, setKeys] = useState<UserKeys[]>([])
  const [grants, setGrants] = useState<VaultGrant[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotating, setRotating] = useState<string | null>(null)
  const [busyRow, setBusyRow] = useState<string | null>(null)
  const [confirmGrant, setConfirmGrant] = useState<UserKeys | null>(null)

  useEffect(() => {
    const subs = [subscribeUsers(setUsers, () => setUsers([])), subscribeAllUserKeys(setKeys), subscribeGrants(setGrants)]
    return () => subs.forEach((u) => u())
  }, [])

  const keyBy = useMemo(() => new Map(keys.map((k) => [k.email, k])), [keys])
  const grantBy = useMemo(() => new Map(grants.map((g) => [g.email, g])), [grants])
  const sorted = useMemo(() => [...(users ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.displayName.localeCompare(b.displayName, 'pt')), [users])

  const row = async (email: string, fn: () => Promise<void>) => {
    setBusyRow(email)
    try {
      await fn()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusyRow(null)
    }
  }

  const changeUser = (u: UserProfile, patch: Partial<Pick<UserProfile, 'role' | 'active'>>) =>
    row(u.email, async () => {
      const next = { ...u, ...patch }
      await upsertUser({ email: u.email, displayName: u.displayName, role: next.role, active: next.active }, actor, false)
      // Quem deixa de poder ver secrets perde logo o acesso ao Credentials Vault.
      if ((next.role === 'viewer' || !next.active) && grantBy.has(u.email)) await revokeVault(u.email, actor)
      toast('Utilizador atualizado.')
    })

  const doGrant = (k: UserKeys) =>
    row(k.email, async () => {
      if (!vault.key || !vault.meta) return setUnlockOpen(true)
      await grantVault(k, vault.key, vault.meta.version, actor)
      toast(`Acesso ao Credentials Vault dado a ${k.email}.`)
    })

  return (
    <>
      <PageHeader
        title="Access Control"
        description="Só entra quem estiver nesta lista. Viewers veem fichas; Editors editam e podem receber acesso ao Credentials Vault; Admins gerem tudo."
        actions={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <UserPlus size={14} aria-hidden />
            Dar acesso
          </Button>
        }
      />
      <div className="flex flex-col gap-6">
        {users === null ? (
          <div className="flex flex-col gap-2" role="status" aria-label="A carregar">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={<Users size={36} weight="thin" />} title="Ainda não há utilizadores" />
        ) : (
          <Panel className="overflow-hidden">
            <ul className="divide-y divide-hairline">
              {sorted.map((u) => {
                const k = keyBy.get(u.email)
                const g = grantBy.get(u.email)
                const isBoot = u.email === BOOTSTRAP_ADMIN
                const canHold = u.active && u.role !== 'viewer'
                const stale = g && vault.meta && g.version !== vault.meta.version
                return (
                  <li key={u.email} className={clsx('flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:gap-6', !u.active && 'opacity-60')}>
                    <div className="flex min-w-0 items-center gap-3 lg:w-72">
                      <Avatar name={u.displayName} className="size-8" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {u.displayName} {u.email === me ? <span className="text-ink-subtle">(tu)</span> : null}
                        </p>
                        <p className="truncate text-[12px] text-ink-subtle">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:w-64">
                      <Select aria-label={`Papel de ${u.displayName}`} value={u.role} disabled={isBoot || busyRow === u.email} onChange={(e) => changeUser(u, { role: e.target.value as Role })} wrapperClassName="w-28" className="h-8 text-[13px]">
                        {ROLES.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                      <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-ink-muted select-none">
                        <input type="checkbox" checked={u.active} disabled={isBoot || busyRow === u.email} onChange={(e) => changeUser(u, { active: e.target.checked })} className="accent-[var(--accent)]" />
                        Ativo
                      </label>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {u.role === 'viewer' ? (
                        <span className="text-[13px] text-ink-subtle">Sem Credentials Vault (Viewer)</span>
                      ) : !k ? (
                        <StatusPill tone="run">Sem chaves criadas</StatusPill>
                      ) : (
                        <>
                          <span className="tg mn tracking-wider" title="Impressão digital da chave pública. Confirma com a pessoa antes de dar acesso.">
                            <Fingerprint size={12} aria-hidden />
                            {k.fingerprint}
                          </span>
                          {g && !stale ? (
                            <StatusPill tone="ok">
                              <ShieldCheck size={12} weight="bold" aria-hidden />
                              Com acesso
                            </StatusPill>
                          ) : stale ? (
                            <StatusPill tone="warn">Acesso desatualizado</StatusPill>
                          ) : (
                            <StatusPill tone="warn">À espera de acesso</StatusPill>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                      {k && canHold && (!g || stale) ? (
                        <Button size="sm" variant="primary" loading={busyRow === u.email} onClick={() => (vault.key ? setConfirmGrant(k) : setUnlockOpen(true))}>
                          <Key size={14} aria-hidden />
                          Dar acesso ao Credentials Vault
                        </Button>
                      ) : null}
                      {g && u.email !== me ? (
                        <Button size="sm" variant="ghost" onClick={() => row(u.email, async () => (await revokeVault(u.email, actor), toast('Acesso ao Credentials Vault retirado.')))}>
                          Retirar acesso
                        </Button>
                      ) : null}
                      {k && u.email !== me ? (
                        <Button size="sm" variant="ghost" onClick={() => row(u.email, async () => (await resetKeys(u.email, actor), toast('Chaves apagadas. A pessoa tem de criar novas.')))}>
                          Repor chaves
                        </Button>
                      ) : null}
                      <span className="text-[11px] text-ink-subtle" title={fmtDateTime(u.lastLoginAt ?? null)}>
                        {u.lastLoginAt ? `Entrou ${fmtRelative(u.lastLoginAt)}` : 'Nunca entrou'}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Panel>
        )}

        <Panel className="p-5">
          <div className="flex flex-wrap items-start gap-4">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
              <ArrowsClockwise size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">Rodar a chave do Credentials Vault</h2>
              <p className="mt-1 max-w-[65ch] text-sm text-ink-muted">
                Gera uma chave nova, volta a cifrar todos os secrets e renova o acesso de quem o tem. Faz isto quando alguém sai da equipa depois de ter tido acesso. Versão atual: {vault.meta?.version ?? 'sem Credentials Vault'}.
              </p>
              {rotating ? <p className="mt-2 text-[13px] text-accent-text" role="status">{rotating}</p> : null}
            </div>
            <Button disabled={!vault.meta} onClick={() => (vault.key ? setRotateOpen(true) : setUnlockOpen(true))}>
              {vault.key ? null : <LockKey size={14} aria-hidden />}
              Rodar chave
            </Button>
          </div>
        </Panel>
      </div>

      <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} existing={(users ?? []).map((u) => u.email)} />
      <UnlockDialog open={unlockOpen} onClose={() => setUnlockOpen(false)} />
      <ConfirmDialog
        open={!!confirmGrant}
        onClose={() => setConfirmGrant(null)}
        title={`Dar acesso ao Credentials Vault a ${confirmGrant?.email}?`}
        body={
          <>
            Confirma com a pessoa que a impressão digital dela é esta:
            <span className="tg mn mt-3 w-fit px-3 py-1.5 text-[13px] tracking-wider text-ink">{confirmGrant?.fingerprint}</span>
            <span className="mt-3 block">Ela passa a ver todos os secrets de todas as apps.</span>
          </>
        }
        confirmLabel="Dar acesso"
        onConfirm={() => {
          if (confirmGrant) doGrant(confirmGrant)
          setConfirmGrant(null)
        }}
      />
      <ConfirmDialog
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        title="Rodar a chave do Credentials Vault?"
        body="Todos os secrets são cifrados de novo com uma chave nova numa só operação. Quem tem o Credentials Vault aberto noutra sessão tem de o desbloquear outra vez."
        confirmLabel="Rodar agora"
        loading={!!rotating}
        onConfirm={async () => {
          if (!vault.key || !vault.meta) return
          try {
            setRotating('A preparar…')
            const nk = await rotateVault(vault.key, vault.meta.version, grants, keys, actor, setRotating)
            vault.adoptKey(nk)
            toast('Chave rodada. Todos os acessos foram renovados.')
          } catch (e) {
            toast(`A rotação não foi feita: ${(e as Error).message}`, 'error')
          } finally {
            setRotating(null)
            setRotateOpen(false)
          }
        }}
      />
    </>
  )
}
