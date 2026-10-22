import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ClockCountdown, Copy, Eye, EyeSlash, Key, MagnifyingGlass, PencilSimple, TextAa, Trash } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { daysUntil } from '../lib/app-utils'
import { ENVS, REVEAL_SECONDS, ROTATION_WARNING_DAYS, SECRET_TYPES, secretTypeLabel, vaultKindLabel } from '../lib/constants'
import { parseDotenv } from '../lib/dotenv'
import { fmtDate } from '../lib/format'
import { VAULT_NAME_RE, type ItemUse } from '../lib/vault-utils'
import { linkVaultItems, logAudit, revealVaultItem, saveVaultItem } from '../data/store'
import type { AgenticApp, EnvKey, SecretType, VaultItem, VaultItemKind } from '../lib/types'
import { Badge, Button, Dialog, Field, IconButton, Input, Segmented, Select, Textarea } from './ui'

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

/** Ícone do tipo de item: chave para secrets, "Aa" para variáveis. */
export function KindIcon({ kind, size = 14 }: { kind: VaultItemKind; size?: number }) {
  return kind === 'secret' ? <Key size={size} className="shrink-0 text-accent-text" aria-hidden /> : <TextAa size={size} className="shrink-0 text-ink-subtle" aria-hidden />
}

export function RotationBadge({ rotateBy }: { rotateBy: string }) {
  const days = daysUntil(rotateBy)
  if (days === null) return null
  return (
    <Badge tone={days < 0 ? 'danger' : days <= ROTATION_WARNING_DAYS ? 'warning' : 'neutral'} title={`Rodar até ${fmtDate(rotateBy)}`}>
      <ClockCountdown size={10} weight="bold" aria-hidden />
      {days < 0 ? `Expirou há ${-days} d` : days === 0 ? 'Rodar hoje' : `Rodar em ${days} d`}
    </Badge>
  )
}

/* ---------------- Linha de item (página do Credentials Vault) ---------------- */

export function VaultItemRow({ item, uses, onEdit, onDelete, requestUnlock }: { item: VaultItem; uses: ItemUse[]; onEdit: () => void; onDelete: () => void; requestUnlock: () => void }) {
  const vault = useVault()
  const { actor } = useAuth()
  const toast = useToast()
  const [shown, setShown] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const rowRef = useRef<HTMLLIElement>(null)

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])
  useEffect(() => {
    if (!vault.key) setShown(null)
  }, [vault.key])
  useEffect(() => {
    if (window.location.hash === `#item-${item.id}`) {
      rowRef.current?.scrollIntoView({ block: 'center' })
      rowRef.current?.focus()
    }
  }, [item.id])

  const outdated = vault.meta && item.version !== vault.meta.version

  const withKey = async (fn: (k: CryptoKey) => Promise<void>) => {
    if (!vault.key) return requestUnlock()
    try {
      await fn(vault.key)
    } catch (e) {
      toast(`Não foi possível decifrar: ${(e as Error).message || 'chave errada'}`, 'error')
    }
  }

  const reveal = () =>
    withKey(async (k) => {
      if (shown !== null) return setShown(null)
      setShown(await revealVaultItem(item, k))
      logAudit(actor, 'reveal', { target: item.name })
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setShown(null), REVEAL_SECONDS * 1000)
    })

  const copy = () =>
    withKey(async (k) => {
      await copyText(await revealVaultItem(item, k))
      logAudit(actor, 'copy', { target: item.name })
      toast(`${item.name} copiado. Cola-o onde precisas e não o deixes em notas.`)
    })

  return (
    <li ref={rowRef} id={`item-${item.id}`} tabIndex={-1} className="group relative flex flex-col gap-2 px-4 py-3 outline-none focus-visible:bg-accent-soft lg:flex-row lg:items-center lg:gap-4">
      <div className="min-w-0 lg:w-72">
        <div className="flex items-center gap-2">
          <KindIcon kind={item.kind} />
          <span className="truncate font-mono text-[13px] text-ink" title={item.name}>
            {item.name}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-[22px]">
          <Badge>{item.kind === 'secret' ? secretTypeLabel(item.type) : 'Variável'}</Badge>
          <RotationBadge rotateBy={item.rotateBy} />
          {outdated ? <Badge tone="warning">Versão de chave antiga</Badge> : null}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative overflow-hidden rounded-lg">
          <code className={clsx('block truncate bg-surface-2 px-2.5 py-1.5 font-mono text-[12px]', shown !== null ? 'text-ink' : 'tracking-[0.2em] text-ink-tertiary')}>{shown !== null ? shown || '(vazio)' : '••••••••••••••••'}</code>
          {shown !== null ? <span aria-hidden className="countdown absolute right-0 bottom-0 left-0 h-0.5 bg-ink/40" style={{ animationDuration: `${REVEAL_SECONDS}s` }} /> : null}
        </div>
        {item.note ? <p className="mt-1 truncate text-[12px] text-ink-subtle">{item.note}</p> : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1 lg:w-64">
        {uses.length ? (
          uses.map((u) => (
            <Link key={`${u.app.id}-${u.env}`} to={`/apps/${u.app.id}?tab=ambientes&env=${u.env}`} className="tg max-w-full truncate hover:bg-surface-3" title={`${u.app.name} (${u.env.toUpperCase()})`}>
              <span className="truncate">{u.app.name}</span>
              <span className="font-mono text-[10.5px] text-ink-subtle">{u.env.toUpperCase()}</span>
            </Link>
          ))
        ) : (
          <span className="text-[12px] text-ink-tertiary">Não está ligado a nenhuma app</span>
        )}
      </div>
      <div className="flex items-center gap-0.5 lg:opacity-70 lg:transition-opacity lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        <IconButton label={shown !== null ? `Esconder ${item.name}` : `Revelar ${item.name}`} onClick={reveal}>
          {shown !== null ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </IconButton>
        <IconButton label={`Copiar ${item.name}`} onClick={copy}>
          <Copy size={16} aria-hidden />
        </IconButton>
        <IconButton label={`Editar ${item.name}`} onClick={onEdit}>
          <PencilSimple size={16} aria-hidden />
        </IconButton>
        <IconButton label={`Apagar ${item.name}`} onClick={onDelete} className="hover:text-danger">
          <Trash size={16} aria-hidden />
        </IconButton>
      </div>
    </li>
  )
}

/* ---------------- Criar / editar item ---------------- */

export function VaultItemDialog({
  open,
  onClose,
  editing,
  linkTo,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  editing: VaultItem | null
  /** Ao criar, liga logo o item a esta app e ambiente. */
  linkTo?: { app: AgenticApp; env: EnvKey } | null
  onSaved?: (id: string) => void
}) {
  const vault = useVault()
  const { actor } = useAuth()
  const toast = useToast()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<VaultItemKind>('secret')
  const [type, setType] = useState<SecretType>('api_key')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [rotateBy, setRotateBy] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(editing?.name ?? '')
    setKind(editing?.kind ?? 'secret')
    setType(editing?.type ?? 'api_key')
    setValue('')
    setNote(editing?.note ?? '')
    setRotateBy(editing?.rotateBy ?? '')
    setShow(false)
    setErr(null)
  }, [open, editing])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!VAULT_NAME_RE.test(n)) return setErr('Usa letras, números e _ (ex.: GEMINI_API_KEY).')
    if (!editing && !value) return setErr('Falta o valor.')
    if (!vault.key || !vault.meta) return setErr('O Credentials Vault está bloqueado.')
    setBusy(true)
    try {
      const id = await saveVaultItem({ id: editing?.id, name: n, kind, type, note, rotateBy, value: value || undefined }, vault.key, vault.meta.version, actor)
      if (!editing && linkTo) {
        await linkVaultItems(linkTo.app, linkTo.env, [{ id, name: n } as VaultItem], actor)
      }
      toast(editing ? `${n} atualizado.` : linkTo ? `${n} criado no Credentials Vault e ligado a ${linkTo.app.name} (${linkTo.env.toUpperCase()}).` : `${n} guardado e cifrado no Credentials Vault.`)
      onSaved?.(id)
      onClose()
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const multiline = kind === 'secret' && (type === 'service_account' || type === 'connection_string')
  const dupes = !editing && name.trim() ? vault.items.filter((i) => i.name === name.trim()).length : 0
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${editing.name}` : 'Novo item no Credentials Vault'}
      description={
        linkTo && !editing
          ? `Fica guardado no Credentials Vault e ligado a ${linkTo.app.name} (${linkTo.env.toUpperCase()}). O valor é cifrado no teu browser antes de sair daqui.`
          : 'O valor é cifrado no teu browser antes de sair daqui. Nas fichas das apps só aparece o nome.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="vault-item-form" loading={busy}>
            {editing ? 'Guardar' : 'Guardar no Credentials Vault'}
          </Button>
        </>
      }
    >
      <form id="vault-item-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[12px] font-medium text-ink-subtle">Tipo de item</span>
          <Segmented<VaultItemKind>
            label="Tipo de item"
            value={kind}
            onChange={setKind}
            className="w-fit"
            options={[
              { value: 'secret', label: 'Secret' },
              { value: 'variable', label: 'Variável' },
            ]}
          />
        </div>
        <div className={clsx('grid grid-cols-1 gap-4', kind === 'secret' && 'sm:grid-cols-[1fr_200px]')}>
          <Field label="Nome" htmlFor="vi-name" error={err} hint={dupes ? `Já há ${dupes} item(ns) com este nome. Usa a nota para os distinguir (ex.: "PROD da app X").` : 'É o nome que aparece nas fichas e no .env.'}>
            <Input id="vi-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'secret' ? 'GEMINI_API_KEY' : 'VITE_API_URL'} className="font-mono text-[13px]" spellCheck={false} autoComplete="off" aria-invalid={!!err} />
          </Field>
          {kind === 'secret' ? (
            <Field label="Categoria" htmlFor="vi-type">
              <Select id="vi-type" value={type} onChange={(e) => setType(e.target.value as SecretType)}>
                {SECRET_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
        <Field label="Valor" htmlFor="vi-value" hint={editing ? 'Deixa vazio para manter o valor atual.' : undefined}>
          {multiline ? (
            <Textarea id="vi-value" value={value} onChange={(e) => setValue(e.target.value)} className="min-h-32 font-mono text-[12px]" spellCheck={false} autoComplete="off" />
          ) : (
            <div className="relative">
              <Input id="vi-value" type={show || kind === 'variable' ? 'text' : 'password'} value={value} onChange={(e) => setValue(e.target.value)} className="pr-10 font-mono text-[13px]" spellCheck={false} autoComplete="new-password" />
              {kind === 'secret' ? (
                <IconButton label={show ? 'Esconder valor' : 'Mostrar valor'} onClick={() => setShow((s) => !s)} className="absolute top-0.5 right-0.5">
                  {show ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </IconButton>
              ) : null}
            </div>
          )}
        </Field>
        <div className={clsx('grid grid-cols-1 gap-4', kind === 'secret' && 'sm:grid-cols-[1fr_200px]')}>
          <Field label="Nota" htmlFor="vi-note" hint="Ex.: para que app ou ambiente é, onde foi gerado, quem é o dono.">
            <Input id="vi-note" value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
          </Field>
          {kind === 'secret' ? (
            <Field label="Rodar até" htmlFor="vi-rotate">
              <Input id="vi-rotate" type="date" value={rotateBy} onChange={(e) => setRotateBy(e.target.value)} />
            </Field>
          ) : null}
        </div>
      </form>
    </Dialog>
  )
}

/* ---------------- Escolher itens do Credentials Vault para uma app ---------------- */

export function VaultPickerDialog({ open, onClose, app, env, uses, onCreateNew }: { open: boolean; onClose: () => void; app: AgenticApp; env: EnvKey; uses: Map<string, ItemUse[]>; onCreateNew: () => void }) {
  const vault = useVault()
  const { actor } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const linked = app.environments[env].vaultRefs

  useEffect(() => {
    if (!open) return
    setQ('')
    setPicked(new Set())
  }, [open])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return vault.items.filter((i) => !linked.includes(i.id) && (!s || i.name.toLowerCase().includes(s) || i.note.toLowerCase().includes(s)))
  }, [vault.items, linked, q])

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const run = async () => {
    setBusy(true)
    try {
      const items = vault.items.filter((i) => picked.has(i.id))
      await linkVaultItems(app, env, items, actor)
      toast(`${items.length} ${items.length === 1 ? 'item ligado' : 'itens ligados'} a ${env.toUpperCase()}.`)
      onClose()
    } catch (e) {
      toast(`Não foi possível ligar: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={`Ligar do Credentials Vault a ${env.toUpperCase()}`}
      description="Escolhe pelo nome. A app só guarda a ligação; o valor continua cifrado no Credentials Vault."
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={onCreateNew}>
            Criar novo no Credentials Vault
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!picked.size} loading={busy} onClick={run}>
            {picked.size ? `Ligar ${picked.size}` : 'Ligar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <MagnifyingGlass size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-tertiary" aria-hidden />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar pelo nome ou pela nota" aria-label="Procurar no Credentials Vault" className="pl-8" spellCheck={false} autoFocus />
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-card shadow-e2">
          {!vault.itemsLoaded ? (
            <p className="px-4 py-6 text-center text-sm text-ink-subtle">A carregar…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-subtle">{vault.items.length ? 'Nada por ligar com este nome.' : 'O Credentials Vault ainda está vazio. Cria o primeiro item.'}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {rows.map((i) => {
                const u = uses.get(i.id) ?? []
                const on = picked.has(i.id)
                return (
                  <li key={i.id}>
                    <label className={clsx('flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2', on && 'bg-accent-soft')}>
                      <input type="checkbox" checked={on} onChange={() => toggle(i.id)} className="accent-[var(--accent)]" aria-label={`Ligar ${i.name}`} />
                      <KindIcon kind={i.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[13px] text-ink">{i.name}</span>
                        <span className="block truncate text-[12px] text-ink-subtle">
                          {[vaultKindLabel(i.kind), i.kind === 'secret' ? secretTypeLabel(i.type) : '', i.note].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-[12px] text-ink-subtle sm:block">{u.length ? `Em ${u.length} ${u.length === 1 ? 'ambiente' : 'ambientes'}` : 'Por usar'}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  )
}

/* ---------------- Importar .env para o Credentials Vault ---------------- */

export function ImportEnvDialog({ open, onClose, apps, initialTarget }: { open: boolean; onClose: () => void; apps: AgenticApp[]; initialTarget?: { appId: string; env: EnvKey } | null }) {
  const vault = useVault()
  const { actor, canEdit } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [appId, setAppId] = useState('')
  const [env, setEnv] = useState<EnvKey>('dev')
  const [choices, setChoices] = useState<Record<string, { include: boolean; secret: boolean }>>({})
  const [busy, setBusy] = useState(false)
  const parsed = useMemo(() => parseDotenv(text), [text])
  const app = apps.find((a) => a.id === appId)

  useEffect(() => {
    setChoices((c) => {
      const n: typeof c = {}
      for (const p of parsed) n[p.key] = c[p.key] ?? { include: true, secret: p.looksSecret }
      return n
    })
  }, [parsed])

  useEffect(() => {
    if (!open) return
    setText('')
    setAppId(initialTarget?.appId ?? '')
    setEnv(initialTarget?.env ?? 'dev')
  }, [open, initialTarget])

  // Itens já ligados ao destino: um nome igual atualiza esse item em vez de criar outro.
  const targetItems = useMemo(() => (app ? app.environments[env].vaultRefs.map((id) => vault.itemsById.get(id)).filter((x): x is VaultItem => !!x) : []), [app, env, vault.itemsById])
  const selected = parsed.filter((p) => choices[p.key]?.include)

  const run = async () => {
    if (!vault.key || !vault.meta) return
    setBusy(true)
    try {
      const toLink: VaultItem[] = []
      let created = 0
      let updated = 0
      for (const p of selected) {
        const c = choices[p.key]
        const ex = targetItems.find((i) => i.name === p.key)
        const id = await saveVaultItem(
          { id: ex?.id, name: p.key, kind: c.secret ? 'secret' : 'variable', type: ex?.type ?? 'other', note: ex?.note ?? (app ? `Importado de .env (${app.name}, ${env.toUpperCase()})` : 'Importado de .env'), rotateBy: ex?.rotateBy ?? '', value: p.value },
          vault.key,
          vault.meta.version,
          actor,
        )
        if (ex) updated++
        else {
          created++
          toLink.push({ id, name: p.key } as VaultItem)
        }
      }
      if (app && toLink.length) await linkVaultItems(app, env, toLink, actor)
      await logAudit(actor, 'import_env', { appId: app?.id, appName: app?.name, env: app ? env : undefined, detail: `${created} criados, ${updated} atualizados` })
      toast(`Importado para o Credentials Vault: ${created} novos e ${updated} atualizados${app ? `, ligados a ${app.name} (${env.toUpperCase()})` : ''}.`)
      onClose()
    } catch (e) {
      toast(`A importação parou: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const enabledEnvs = app ? ENVS.filter((e) => app.environments[e.key].enabled) : ENVS
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Importar .env para o Credentials Vault"
      description="Cola o conteúdo do ficheiro. Tudo é cifrado no teu browser antes de ser gravado. Se escolheres uma app, os itens ficam ligados a ela."
      footer={
        <>
          {!vault.key ? <span className="mr-auto text-[13px] text-warning">Desbloqueia o Credentials Vault para importar.</span> : null}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!selected.length || !vault.key || !canEdit} loading={busy} onClick={run}>
            {selected.length ? `Importar ${selected.length}` : 'Importar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
          <Field label="Ligar a uma app (opcional)" htmlFor="imp-app">
            <Select id="imp-app" value={appId} onChange={(e) => setAppId(e.target.value)}>
              <option value="">Só guardar no Credentials Vault</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ambiente" htmlFor="imp-env">
            <Select id="imp-env" value={env} onChange={(e) => setEnv(e.target.value as EnvKey)} disabled={!app}>
              {enabledEnvs.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.short}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Conteúdo do .env" htmlFor="env-text">
          <Textarea id="env-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={'VITE_API_URL=https://...\nGEMINI_API_KEY=...'} className="min-h-36 font-mono text-[12px]" spellCheck={false} autoComplete="off" />
        </Field>
        {parsed.length ? (
          <div className="overflow-hidden rounded-card shadow-e2">
            <table className="w-full text-[13px]">
              <thead className="bg-surface-2 font-display text-[12px] text-ink-subtle">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2 text-left font-medium">
                    <span className="sr-only">Incluir</span>
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Nome
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Guardar como
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {parsed.map((p) => {
                  const c = choices[p.key] ?? { include: true, secret: p.looksSecret }
                  const exists = targetItems.some((i) => i.name === p.key)
                  return (
                    <tr key={p.key} className={c.include ? '' : 'opacity-50'}>
                      <td className="px-3 py-2">
                        <input type="checkbox" aria-label={`Incluir ${p.key}`} checked={c.include} onChange={(e) => setChoices((x) => ({ ...x, [p.key]: { ...c, include: e.target.checked } }))} className="accent-[var(--accent)]" />
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-ink">{p.key}</span>
                        {exists ? <span className="ml-2 text-[11px] text-warning">atualiza o valor atual</span> : null}
                      </td>
                      <td className="px-3 py-2">
                        <Segmented<'var' | 'secret'>
                          label={`Tipo de ${p.key}`}
                          value={c.secret ? 'secret' : 'var'}
                          onChange={(v) => setChoices((x) => ({ ...x, [p.key]: { ...c, secret: v === 'secret' } }))}
                          className="[&_button]:h-[26px] [&_button]:px-2.5 [&_button]:text-[12px]"
                          options={[
                            { value: 'var', label: 'Variável' },
                            { value: 'secret', label: 'Secret' },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
