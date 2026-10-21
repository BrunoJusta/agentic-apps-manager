import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ArrowSquareOut,
  ClockCountdown,
  Copy,
  Database,
  DownloadSimple,
  Eye,
  EyeSlash,
  Globe,
  HardDrives,
  Key,
  LockKey,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'
import { useVault } from '../context/VaultContext'
import { useToast } from '../context/ToastContext'
import { daysUntil } from '../lib/app-utils'
import { REVEAL_SECONDS, ROTATION_WARNING_DAYS, SECRET_TYPES, secretTypeLabel } from '../lib/constants'
import { parseDotenv, serializeDotenv } from '../lib/dotenv'
import { fmtDate } from '../lib/format'
import { deleteSecret, logAudit, revealSecret, saveSecret, saveVariables } from '../data/store'
import type { AgenticApp, EnvKey, SecretDoc, SecretType, Variable } from '../lib/types'
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, Field, IconButton, Input, Panel, Segmented, Select, Textarea } from './ui'
import { UnlockDialog } from './VaultGate'

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function InfoItem({ icon, label, value, href, mono }: { icon: React.ReactNode; label: string; value: string; href?: string; mono?: boolean }) {
  const toast = useToast()
  return (
    <div className="flex min-w-0 items-start gap-3 py-2.5">
      <span className="mt-0.5 text-ink-tertiary" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-ink-subtle">{label}</p>
        {value ? (
          <div className="flex min-w-0 items-center gap-1">
            {href ? (
              <a href={href} target="_blank" rel="noreferrer" className={clsx('truncate text-sm text-ink hover:text-accent-text', mono && 'font-mono text-[13px]')}>
                {value}
              </a>
            ) : (
              <span className={clsx('truncate text-sm text-ink', mono && 'font-mono text-[13px]')}>{value}</span>
            )}
            {href ? <ArrowSquareOut size={12} className="shrink-0 text-ink-tertiary" aria-hidden /> : null}
            <IconButton
              label={`Copiar ${label}`}
              className="size-6"
              onClick={async () => {
                await copyText(value)
                toast(`${label} copiado.`)
              }}
            >
              <Copy size={12} aria-hidden />
            </IconButton>
          </div>
        ) : (
          <p className="text-sm text-ink-tertiary">Por definir</p>
        )}
      </div>
    </div>
  )
}

/* ---------------- Secret: linha ---------------- */

function SecretRow({ secret, app, onEdit, onDelete, requestUnlock }: { secret: SecretDoc; app: AgenticApp; onEdit: () => void; onDelete: () => void; requestUnlock: () => void }) {
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
    if (window.location.hash === `#secret-${secret.id}`) {
      rowRef.current?.scrollIntoView({ block: 'center' })
      rowRef.current?.focus()
    }
  }, [secret.id])

  const days = daysUntil(secret.rotateBy)
  const outdated = vault.meta && secret.version !== vault.meta.version

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
      if (shown !== null) {
        setShown(null)
        return
      }
      const v = await revealSecret(secret, k)
      setShown(v)
      logAudit(actor, 'reveal', { appId: app.id, appName: app.name, env: secret.env, target: secret.name })
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setShown(null), REVEAL_SECONDS * 1000)
    })

  const copy = () =>
    withKey(async (k) => {
      const v = await revealSecret(secret, k)
      await copyText(v)
      logAudit(actor, 'copy', { appId: app.id, appName: app.name, env: secret.env, target: secret.name })
      toast(`${secret.name} copiado. Cola-o onde precisas e não o deixes em notas.`)
    })

  return (
    <li ref={rowRef} id={`secret-${secret.id}`} tabIndex={-1} className="group relative flex flex-col gap-2 px-4 py-3 outline-none focus-visible:bg-accent-soft sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 sm:w-64">
        <div className="flex items-center gap-2">
          <Key size={14} className="shrink-0 text-accent-text" aria-hidden />
          <span className="truncate font-mono text-[13px] text-ink" title={secret.name}>
            {secret.name}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-[22px]">
          <Badge>{secretTypeLabel(secret.type)}</Badge>
          {days !== null ? (
            <Badge tone={days < 0 ? 'danger' : days <= ROTATION_WARNING_DAYS ? 'warning' : 'neutral'} title={`Rodar até ${fmtDate(secret.rotateBy)}`}>
              <ClockCountdown size={10} weight="bold" aria-hidden />
              {days < 0 ? `Expirou há ${-days} d` : days === 0 ? 'Rodar hoje' : `Rodar em ${days} d`}
            </Badge>
          ) : null}
          {outdated ? <Badge tone="warning">Versão de chave antiga</Badge> : null}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative overflow-hidden rounded-lg">
          <code className={clsx('block truncate bg-surface-2 px-2.5 py-1.5 font-mono text-[12px]', shown !== null ? 'text-ink' : 'tracking-[0.2em] text-ink-tertiary')}>
            {shown !== null ? shown || '(vazio)' : '••••••••••••••••'}
          </code>
          {shown !== null ? <span aria-hidden className="countdown absolute right-0 bottom-0 left-0 h-0.5 bg-ink/40" style={{ animationDuration: `${REVEAL_SECONDS}s` }} /> : null}
        </div>
        {secret.note ? <p className="mt-1 truncate text-[12px] text-ink-subtle">{secret.note}</p> : null}
      </div>
      <div className="flex items-center gap-0.5 sm:opacity-70 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <IconButton label={shown !== null ? `Esconder ${secret.name}` : `Revelar ${secret.name}`} onClick={reveal}>
          {shown !== null ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </IconButton>
        <IconButton label={`Copiar ${secret.name}`} onClick={copy}>
          <Copy size={16} aria-hidden />
        </IconButton>
        <IconButton label={`Editar ${secret.name}`} onClick={onEdit}>
          <PencilSimple size={16} aria-hidden />
        </IconButton>
        <IconButton label={`Apagar ${secret.name}`} onClick={onDelete} className="hover:text-danger">
          <Trash size={16} aria-hidden />
        </IconButton>
      </div>
    </li>
  )
}

/* ---------------- Secret: diálogo criar/editar ---------------- */

function SecretDialog({ open, onClose, app, env, editing, existingNames }: { open: boolean; onClose: () => void; app: AgenticApp; env: EnvKey; editing: SecretDoc | null; existingNames: string[] }) {
  const vault = useVault()
  const { actor } = useAuth()
  const toast = useToast()
  const [name, setName] = useState('')
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
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(n)) return setErr('Usa letras, números e _ (ex.: GEMINI_API_KEY).')
    if (existingNames.includes(n) && n !== editing?.name) return setErr('Já existe um secret com este nome neste ambiente.')
    if (!editing && !value) return setErr('Falta o valor.')
    if (!vault.key || !vault.meta) return setErr('O cofre está bloqueado.')
    setBusy(true)
    try {
      await saveSecret({ id: editing?.id, appId: app.id, env, name: n, type, note, rotateBy, value: value || undefined }, vault.key, vault.meta.version, actor, app.name)
      toast(editing ? 'Secret atualizado.' : 'Secret guardado e cifrado.')
      onClose()
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const multiline = type === 'service_account' || type === 'connection_string'
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${editing.name}` : `Novo secret em ${env.toUpperCase()}`}
      description="O valor é cifrado no teu browser antes de sair daqui."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="secret-form" loading={busy}>
            {editing ? 'Guardar' : 'Guardar secret'}
          </Button>
        </>
      }
    >
      <form id="secret-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Nome" htmlFor="s-name" error={err}>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="GEMINI_API_KEY" className="font-mono text-[13px]" spellCheck={false} autoComplete="off" aria-invalid={!!err} aria-describedby={err ? 's-name-error' : undefined} />
          </Field>
          <Field label="Tipo" htmlFor="s-type">
            <Select id="s-type" value={type} onChange={(e) => setType(e.target.value as SecretType)}>
              {SECRET_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Valor" htmlFor="s-value" hint={editing ? 'Deixa vazio para manter o valor atual.' : undefined}>
          {multiline ? (
            <Textarea id="s-value" value={value} onChange={(e) => setValue(e.target.value)} className="min-h-32 font-mono text-[12px]" spellCheck={false} autoComplete="off" />
          ) : (
            <div className="relative">
              <Input id="s-value" type={show ? 'text' : 'password'} value={value} onChange={(e) => setValue(e.target.value)} className="pr-10 font-mono text-[13px]" spellCheck={false} autoComplete="new-password" />
              <IconButton label={show ? 'Esconder valor' : 'Mostrar valor'} onClick={() => setShow((s) => !s)} className="absolute top-0.5 right-0.5">
                {show ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </IconButton>
            </div>
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Nota" htmlFor="s-note" hint="Ex.: onde foi gerado, quem é o dono.">
            <Input id="s-note" value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Rodar até" htmlFor="s-rotate">
            <Input id="s-rotate" type="date" value={rotateBy} onChange={(e) => setRotateBy(e.target.value)} />
          </Field>
        </div>
      </form>
    </Dialog>
  )
}

/* ---------------- Variável: diálogo ---------------- */

function VariableDialog({ open, onClose, onSave, editing, existingKeys }: { open: boolean; onClose: () => void; onSave: (v: Variable) => Promise<void>; editing: Variable | null; existingKeys: string[] }) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setKey(editing?.key ?? '')
    setValue(editing?.value ?? '')
    setNote(editing?.note ?? '')
    setErr(null)
  }, [open, editing])
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${editing.key}` : 'Nova variável'}
      description="Variáveis não são cifradas. Para chaves, passwords ou tokens usa um secret."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="var-form" loading={busy}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        id="var-form"
        onSubmit={async (e) => {
          e.preventDefault()
          const k = key.trim()
          if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(k)) return setErr('Usa letras, números e _ (ex.: VITE_API_URL).')
          if (existingKeys.includes(k) && k !== editing?.key) return setErr('Já existe uma variável com este nome.')
          setBusy(true)
          try {
            await onSave({ key: k, value, note: note.trim() })
            onClose()
          } catch (e2) {
            setErr((e2 as Error).message)
          } finally {
            setBusy(false)
          }
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Nome" htmlFor="v-key" error={err}>
          <Input id="v-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="VITE_API_URL" className="font-mono text-[13px]" spellCheck={false} autoComplete="off" aria-invalid={!!err} />
        </Field>
        <Field label="Valor" htmlFor="v-value">
          <Input id="v-value" value={value} onChange={(e) => setValue(e.target.value)} className="font-mono text-[13px]" spellCheck={false} autoComplete="off" />
        </Field>
        <Field label="Nota" htmlFor="v-note">
          <Input id="v-note" value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
        </Field>
      </form>
    </Dialog>
  )
}

/* ---------------- Importar .env ---------------- */

function ImportEnvDialog({ open, onClose, app, env, secrets }: { open: boolean; onClose: () => void; app: AgenticApp; env: EnvKey; secrets: SecretDoc[] }) {
  const vault = useVault()
  const { actor, canEdit } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [choices, setChoices] = useState<Record<string, { include: boolean; secret: boolean }>>({})
  const [busy, setBusy] = useState(false)
  const parsed = useMemo(() => parseDotenv(text), [text])

  useEffect(() => {
    setChoices((c) => {
      const n: typeof c = {}
      for (const p of parsed) n[p.key] = c[p.key] ?? { include: true, secret: p.looksSecret }
      return n
    })
  }, [parsed])

  useEffect(() => {
    if (!open) setText('')
  }, [open])

  const selected = parsed.filter((p) => choices[p.key]?.include)
  const needsVault = selected.some((p) => choices[p.key]?.secret)
  const blocked = needsVault && !vault.key

  const run = async () => {
    setBusy(true)
    try {
      const vars = [...app.environments[env].variables]
      let nv = 0
      let ns = 0
      for (const p of selected) {
        if (choices[p.key].secret) {
          const ex = secrets.find((s) => s.name === p.key)
          await saveSecret({ id: ex?.id, appId: app.id, env, name: p.key, type: ex?.type ?? 'other', note: ex?.note ?? 'Importado de .env', rotateBy: ex?.rotateBy ?? '', value: p.value }, vault.key!, vault.meta!.version, actor, app.name)
          ns++
        } else {
          const i = vars.findIndex((v) => v.key === p.key)
          if (i >= 0) vars[i] = { ...vars[i], value: p.value }
          else vars.push({ key: p.key, value: p.value, note: '' })
          nv++
        }
      }
      if (nv) await saveVariables(app, env, vars, actor, `Importou ${nv} variáveis de .env (${env.toUpperCase()})`)
      await logAudit(actor, 'import_env', { appId: app.id, appName: app.name, env, detail: `${nv} variáveis, ${ns} secrets` })
      toast(`Importado: ${nv} variáveis e ${ns} secrets.`)
      onClose()
    } catch (e) {
      toast(`A importação parou: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={`Importar .env para ${env.toUpperCase()}`}
      description="Cola o conteúdo do ficheiro. Nada sai do teu browser até carregares em Importar, e os secrets são cifrados antes de serem gravados."
      footer={
        <>
          {blocked ? <span className="mr-auto text-[13px] text-warning">Desbloqueia o cofre para importar secrets.</span> : null}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!selected.length || blocked || !canEdit} loading={busy} onClick={run}>
            {selected.length ? `Importar ${selected.length}` : 'Importar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
                  const exists = c.secret ? secrets.some((s) => s.name === p.key) : app.environments[env].variables.some((v) => v.key === p.key)
                  return (
                    <tr key={p.key} className={c.include ? '' : 'opacity-50'}>
                      <td className="px-3 py-2">
                        <input type="checkbox" aria-label={`Incluir ${p.key}`} checked={c.include} onChange={(e) => setChoices((x) => ({ ...x, [p.key]: { ...c, include: e.target.checked } }))} className="accent-[var(--accent)]" />
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-ink">{p.key}</span>
                        {exists ? <span className="ml-2 text-[11px] text-warning">substitui o atual</span> : null}
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

/* ---------------- Painel do ambiente ---------------- */

export function EnvPanel({ app, env }: { app: AgenticApp; env: EnvKey }) {
  const { canEdit, actor } = useAuth()
  const vault = useVault()
  const toast = useToast()
  const e = app.environments[env]
  const secrets = useMemo(() => vault.secrets.filter((s) => s.appId === app.id && s.env === env).sort((a, b) => a.name.localeCompare(b.name)), [vault.secrets, app.id, env])
  const [secretDlg, setSecretDlg] = useState<{ open: boolean; editing: SecretDoc | null }>({ open: false, editing: null })
  const [varDlg, setVarDlg] = useState<{ open: boolean; editing: Variable | null }>({ open: false, editing: null })
  const [delSecret, setDelSecret] = useState<SecretDoc | null>(null)
  const [delVar, setDelVar] = useState<Variable | null>(null)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!e.enabled) {
    return (
      <Panel>
        <EmptyState icon={<HardDrives size={36} weight="thin" />} title="Este ambiente não existe" body="Ativa-o na ficha da app (Editar, secção Ambientes) para registares base de dados, alojamento, variáveis e secrets." />
      </Panel>
    )
  }

  const saveVar = async (v: Variable) => {
    const list = varDlg.editing ? e.variables.map((x) => (x.key === varDlg.editing!.key ? v : x)) : [...e.variables, v]
    await saveVariables(app, env, list, actor, `${varDlg.editing ? 'Atualizou' : 'Criou'} a variável ${v.key} (${env.toUpperCase()})`)
    toast('Variável guardada.')
  }

  const exportEnv = async () => {
    if (secrets.length && !vault.key) return setUnlockOpen(true)
    setBusy(true)
    try {
      const entries: { key: string; value: string; comment?: string }[] = e.variables.map((v) => ({ key: v.key, value: v.value, comment: v.note || undefined }))
      for (const s of secrets) entries.push({ key: s.name, value: await revealSecret(s, vault.key!), comment: s.note || undefined })
      download(`.env.${env}`, serializeDotenv(entries, `${app.name} (${env.toUpperCase()})\nExportado em ${new Date().toLocaleString('pt-PT')}. Contém secrets: não partilhes nem faças commit.`))
      await logAudit(actor, 'export_env', { appId: app.id, appName: app.name, env, detail: `${e.variables.length} variáveis, ${secrets.length} secrets` })
      toast('Ficheiro .env gerado. Apaga-o quando já não precisares.')
    } catch (err) {
      toast(`Não foi possível exportar: ${(err as Error).message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel className="grid grid-cols-1 gap-x-8 px-5 py-2 md:grid-cols-2">
        <InfoItem icon={<Globe size={16} />} label="URL da app" value={e.appUrl} href={e.appUrl || undefined} />
        <InfoItem icon={<HardDrives size={16} />} label="Alojamento" value={e.hosting} href={e.hostingUrl || undefined} />
        <InfoItem icon={<Database size={16} />} label="Base de dados" value={[e.dbType, e.dbProject].filter(Boolean).join(', ')} href={e.dbUrl || undefined} />
        <InfoItem icon={<Database size={16} />} label="ID da base de dados" value={e.dbId} mono />
        {e.notes ? <p className="border-t border-hairline py-3 text-[13px] whitespace-pre-line text-ink-muted md:col-span-2">{e.notes}</p> : null}
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">Variáveis e secrets</h3>
        <div className="ml-auto flex flex-wrap gap-2">
          {canEdit ? (
            <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)}>
              <UploadSimple size={14} aria-hidden />
              Importar .env
            </Button>
          ) : null}
          {canEdit ? (
            <Button size="sm" variant="ghost" onClick={exportEnv} loading={busy} disabled={!e.variables.length && !secrets.length}>
              <DownloadSimple size={14} aria-hidden />
              Exportar .env
            </Button>
          ) : null}
        </div>
      </div>

      {/* Variáveis */}
      <Panel>
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
          <p className="font-display text-[13.5px] font-semibold text-ink">Variáveis</p>
          <span className="count">{e.variables.length}</span>
          {canEdit ? (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setVarDlg({ open: true, editing: null })}>
              <Plus size={14} aria-hidden />
              Variável
            </Button>
          ) : null}
        </div>
        {e.variables.length ? (
          <ul className="divide-y divide-hairline">
            {e.variables.map((v) => (
              <li key={v.key} className="group flex flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                <span className="truncate font-mono text-[13px] text-ink sm:w-64" title={v.key}>
                  {v.key}
                </span>
                <div className="min-w-0 flex-1">
                  <code className="block truncate font-mono text-[12px] text-ink-muted" title={v.value}>
                    {v.value || '(vazio)'}
                  </code>
                  {v.note ? <p className="truncate text-[12px] text-ink-subtle">{v.note}</p> : null}
                </div>
                <div className="flex items-center gap-0.5 sm:opacity-70 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <IconButton
                    label={`Copiar ${v.key}`}
                    onClick={async () => {
                      await copyText(v.value)
                      toast(`${v.key} copiado.`)
                    }}
                  >
                    <Copy size={16} aria-hidden />
                  </IconButton>
                  {canEdit ? (
                    <>
                      <IconButton label={`Editar ${v.key}`} onClick={() => setVarDlg({ open: true, editing: v })}>
                        <PencilSimple size={16} aria-hidden />
                      </IconButton>
                      <IconButton label={`Apagar ${v.key}`} onClick={() => setDelVar(v)} className="hover:text-danger">
                        <Trash size={16} aria-hidden />
                      </IconButton>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-ink-subtle">Sem variáveis. Adiciona uma, ou importa um .env.</p>
        )}
      </Panel>

      {/* Secrets */}
      <Panel>
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
          <p className="font-display text-[13.5px] font-semibold text-ink">Secrets</p>
          {canEdit ? <span className="count">{secrets.length}</span> : null}
          {canEdit && vault.status !== 'unlocked' ? (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setUnlockOpen(true)}>
              <LockKey size={14} aria-hidden />
              Desbloquear
            </Button>
          ) : null}
          {canEdit && vault.status === 'unlocked' ? (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSecretDlg({ open: true, editing: null })}>
              <Plus size={14} aria-hidden />
              Secret
            </Button>
          ) : null}
        </div>
        {!canEdit ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-subtle">Os secrets só são visíveis para Editors e Admins com acesso ao cofre.</p>
        ) : secrets.length ? (
          <ul className="divide-y divide-hairline">
            {secrets.map((s) => (
              <SecretRow key={s.id} secret={s} app={app} requestUnlock={() => setUnlockOpen(true)} onEdit={() => (vault.key ? setSecretDlg({ open: true, editing: s }) : setUnlockOpen(true))} onDelete={() => setDelSecret(s)} />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-ink-subtle">{vault.status === 'unlocked' ? 'Sem secrets neste ambiente.' : 'Sem secrets neste ambiente. Desbloqueia o cofre para adicionar.'}</p>
        )}
      </Panel>

      <SecretDialog open={secretDlg.open} editing={secretDlg.editing} onClose={() => setSecretDlg({ open: false, editing: null })} app={app} env={env} existingNames={secrets.map((s) => s.name)} />
      <VariableDialog open={varDlg.open} editing={varDlg.editing} onClose={() => setVarDlg({ open: false, editing: null })} onSave={saveVar} existingKeys={e.variables.map((v) => v.key)} />
      <ImportEnvDialog open={importOpen} onClose={() => setImportOpen(false)} app={app} env={env} secrets={secrets} />
      <UnlockDialog open={unlockOpen} onClose={() => setUnlockOpen(false)} />
      <ConfirmDialog
        open={!!delSecret}
        onClose={() => setDelSecret(null)}
        title={`Apagar ${delSecret?.name}?`}
        body="O valor cifrado é apagado de vez. Não há forma de o recuperar a partir daqui."
        confirmLabel="Apagar secret"
        danger
        onConfirm={async () => {
          if (!delSecret) return
          await deleteSecret(delSecret, actor, app.name)
          setDelSecret(null)
          toast('Secret apagado.')
        }}
      />
      <ConfirmDialog
        open={!!delVar}
        onClose={() => setDelVar(null)}
        title={`Apagar ${delVar?.key}?`}
        body="A variável deixa de aparecer neste ambiente."
        confirmLabel="Apagar variável"
        danger
        onConfirm={async () => {
          if (!delVar) return
          await saveVariables(app, env, e.variables.filter((v) => v.key !== delVar.key), actor, `Apagou a variável ${delVar.key} (${env.toUpperCase()})`)
          setDelVar(null)
          toast('Variável apagada.')
        }}
      />
    </div>
  )
}
