import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AppIcon } from '../components/AppCard'
import { fileToSquareIcon } from '../lib/image'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeft, Cloud, Flag, GitBranch, IdentificationCard, ImageSquare, LinkSimple, Plus, ShieldCheck, Stack as StackIcon, X } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  AUTH_OPTIONS,
  DB_TYPES,
  emptyApp,
  ENVS,
  HOSTINGS,
  LINK_SUGGESTIONS,
  MATURITIES,
  DATA_CLASSIFICATIONS,
  PRIORITIES,
  REPO_ACCOUNTS,
  STACK_SUGGESTIONS,
  STATUSES,
} from '../lib/constants'
import { productionReadiness, toInput } from '../lib/app-utils'
import { createApp, updateApp } from '../data/store'
import type { AppInput, EnvKey, Environment, MaturityKey, PriorityKey, RepoAccount, StatusKey } from '../lib/types'
import { Button, ConfirmDialog, EmptyState, Field, IconButton, Input, PersonInput, Segmented, Skeleton, Textarea } from '../components/ui'
import { Combobox, MultiCombobox, PillPicker, Switch } from '../components/fields'
import { PriorityIcon } from '../components/AppCard'

const SECTIONS: { id: string; label: string; icon: Icon }[] = [
  { id: 'identidade', label: 'Identidade', icon: IdentificationCard },
  { id: 'estado', label: 'Estado', icon: Flag },
  { id: 'stack', label: 'Stack', icon: StackIcon },
  { id: 'ambientes', label: 'Ambientes', icon: Cloud },
  { id: 'repositorio', label: 'Repositório', icon: GitBranch },
  { id: 'links', label: 'Links', icon: LinkSimple },
  { id: 'governo', label: 'Governance', icon: ShieldCheck },
]

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[140px] rounded-card bg-surface-1 p-5 shadow-e2 sm:p-6">
      <h2 id={`${id}-title`} className="font-display text-[20px] leading-7 font-semibold tracking-[-0.03em] text-ink sm:text-[24px] sm:leading-8">
        {title}
      </h2>
      {description ? <p className="mt-1 max-w-[65ch] text-[13.5px] text-ink-subtle">{description}</p> : null}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  )
}

function IconPicker({ value, name, area, onChange }: { value: string; name: string; area: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex items-center gap-4">
      <AppIcon app={{ name: name || '?', icon: value, area }} size={72} />
      <div className="flex min-w-0 flex-col gap-2">
        <span className="font-display text-[12px] font-medium text-ink-subtle">Ícone da app</span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            <ImageSquare size={14} aria-hidden />
            {value ? 'Trocar ícone' : 'Carregar ícone'}
          </Button>
          {value ? (
            <Button size="sm" variant="ghost" onClick={() => onChange('')}>
              Remover
            </Button>
          ) : null}
        </div>
        <p className={err ? 'text-[12px] text-danger' : 'text-[12px] text-ink-tertiary'}>{err ?? 'Formato quadrado 1:1. Outras proporções são cortadas ao centro e reduzidas para 256×256.'}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher imagem do ícone"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setBusy(true)
            setErr(null)
            try {
              onChange(await fileToSquareIcon(f))
            } catch (x) {
              setErr((x as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        />
      </div>
    </div>
  )
}

function Datalist({ id, options }: { id: string; options: string[] }) {
  return (
    <datalist id={id}>
      {options.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  )
}

export function AppFormPage() {
  const { id } = useParams()
  const isNew = !id
  const { byId, apps, loading } = useApps()
  const { actor, canEdit } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const existing = id ? byId(id) : undefined

  const initial = useMemo<AppInput | null>(() => {
    if (isNew) {
      const base = emptyApp()
      const st = params.get('estado') as StatusKey | null
      if (st && STATUSES.some((s) => s.key === st) && st !== 'producao') base.status = st
      return base
    }
    return existing ? toInput(existing) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, existing?.id, loading])

  const [form, setForm] = useState<AppInput | null>(initial)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; readiness?: string[] }>({})

  useEffect(() => {
    if (!form && initial) setForm(initial)
  }, [initial, form])

  const dirty = !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const tagSuggestions = useMemo(() => {
    return {
      frontend: [...new Set([...STACK_SUGGESTIONS.frontend, ...apps.flatMap((a) => a.stack.frontend)])],
      backend: [...new Set([...STACK_SUGGESTIONS.backend, ...apps.flatMap((a) => a.stack.backend)])],
      llm: [...new Set([...STACK_SUGGESTIONS.llm, ...apps.flatMap((a) => a.stack.llm)])],
      frameworks: [...new Set([...STACK_SUGGESTIONS.frameworks, ...apps.flatMap((a) => a.stack.frameworks)])],
    }
  }, [apps])
  const areas = useMemo(() => [...new Set(apps.map((a) => a.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')), [apps])
  const infra = useMemo(() => {
    const envs = apps.flatMap((a) => Object.values(a.environments))
    return {
      db: [...new Set([...DB_TYPES, ...envs.map((e) => e.dbType).filter(Boolean)])],
      hosting: [...new Set([...HOSTINGS, ...envs.map((e) => e.hosting).filter(Boolean)])],
      auth: [...new Set([...AUTH_OPTIONS, ...apps.map((a) => a.stack.auth).filter(Boolean)])],
    }
  }, [apps])
  const [activeSection, setActiveSection] = useState('identidade')
  const formReady = !!form
  useEffect(() => {
    if (!formReady) return
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (vis) setActiveSection(vis.target.id)
      },
      { rootMargin: '-120px 0px -55% 0px' },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [formReady])

  if (!canEdit) return <EmptyState title="Só Editors e Admins podem editar fichas." action={<Link to="/" className="text-accent-text underline">Voltar ao board</Link>} />
  if (!isNew && !loading && !existing) return <EmptyState title="Esta app não existe ou foi apagada." action={<Link to="/" className="text-accent-text underline">Voltar ao board</Link>} />
  if (!form) {
    return (
      <div className="flex flex-col gap-3 p-8" role="status" aria-label="A carregar">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  const up = (patch: Partial<AppInput>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const upEnv = (k: EnvKey, patch: Partial<Environment>) => setForm((f) => (f ? { ...f, environments: { ...f.environments, [k]: { ...f.environments[k], ...patch } } } : f))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!form.name.trim()) errs.name = 'Dá um nome à app.'
    if (form.status === 'producao') {
      const r = productionReadiness(form)
      if (!r.ready) errs.readiness = r.missing
    }
    setErrors(errs)
    if (errs.name) {
      document.getElementById('f-name')?.focus()
      return
    }
    if (errs.readiness) {
      document.getElementById('form-errors')?.focus()
      return
    }
    setSaving(true)
    try {
      const clean: AppInput = {
        ...form,
        name: form.name.trim(),
        links: form.links.filter((l) => l.url.trim()),
      }
      if (isNew) {
        const newId = await createApp(clean, actor)
        toast('App criada.')
        navigate(`/apps/${newId}`, { replace: true })
      } else {
        await updateApp(id!, initial!, clean, actor)
        toast('Alterações guardadas.')
        navigate(`/apps/${id}`)
      }
    } catch (err) {
      toast(`Não foi possível guardar: ${(err as Error).message}`, 'error')
      setSaving(false)
    }
  }

  const backTo = isNew ? '/' : `/apps/${id}`

  return (
    <form onSubmit={submit} noValidate className="pb-32">
      <div className="pt-8 pb-6">
        <Link to={backTo} className="inline-flex items-center gap-1 rounded-full font-display text-[13px] font-medium text-ink-subtle hover:text-ink">
          <ArrowLeft size={14} aria-hidden />
          {isNew ? 'Lifecycle Management' : initial?.name}
        </Link>
        <h1 className="mt-3 font-display text-[26px] leading-8 font-semibold tracking-[-0.03em] text-ink min-[760px]:text-[32px] min-[760px]:leading-10">{isNew ? 'Nova app' : 'Editar ficha'}</h1>
      </div>

      <div className="flex gap-8">
        <nav aria-label="Secções do formulário" className="sticky top-[84px] hidden h-fit w-[220px] shrink-0 flex-col gap-0.5 min-[860px]:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={activeSection === s.id ? 'true' : undefined}
              className={clsx(
                'flex h-9 items-center gap-2.5 rounded-lg px-3 font-display text-[13.5px] font-medium transition-[background-color,color,box-shadow] duration-150',
                activeSection === s.id ? 'bg-surface-1 text-ink shadow-e2' : 'text-ink-subtle hover:bg-sel hover:text-ink',
              )}
            >
              <s.icon size={16} weight={activeSection === s.id ? 'fill' : 'regular'} aria-hidden className="shrink-0" />
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {errors.readiness ? (
            <div id="form-errors" tabIndex={-1} role="alert" className="notice danger mb-2 py-2 text-sm text-danger outline-none">
              <p className="font-medium">Para ficar em Production falta:</p>
              <ul className="mt-1 list-inside list-disc">
                {errors.readiness.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Section id="identidade" title="Identidade">
            <IconPicker value={form.icon} name={form.name} area={form.area} onChange={(icon) => up({ icon })} />
            <Field label="Nome" htmlFor="f-name" error={errors.name}>
              <Input id="f-name" value={form.name} onChange={(e) => up({ name: e.target.value })} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'f-name-error' : undefined} autoComplete="off" />
            </Field>
            <Field label="Descrição curta" htmlFor="f-short" hint="Aparece no cartão do board. Uma frase.">
              <Input id="f-short" value={form.shortDescription} maxLength={140} onChange={(e) => up({ shortDescription: e.target.value })} autoComplete="off" />
            </Field>
            <Field label="Descrição" htmlFor="f-desc" hint="O que faz, para quem, e que problema resolve.">
              <Textarea id="f-desc" value={form.description} onChange={(e) => up({ description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Área ou departamento" htmlFor="f-area">
                <Combobox id="f-area" value={form.area} onChange={(area) => up({ area })} options={areas} placeholder="Ex.: Supply Chain" />
              </Field>
            </div>
            <Field label="Prioridade" htmlFor="f-prio">
              <PillPicker<PriorityKey>
                id="f-prio"
                label="Prioridade"
                value={form.priority}
                onChange={(priority) => up({ priority })}
                options={[...PRIORITIES].reverse().map((p) => ({ value: p.key, label: (<><PriorityIcon priority={p.key} />{p.label}</>) }))}
              />
            </Field>
          </Section>

          <Section id="estado" title="Estado" description="Production exige Product Owner e ambiente de produção preenchidos. O repositório é opcional.">
            <Field label="Estado" htmlFor="f-status">
              <PillPicker<StatusKey> id="f-status" label="Estado" value={form.status} onChange={(status) => up({ status })} options={STATUSES.map((s) => ({ value: s.key, label: s.label, title: s.hint }))} />
            </Field>
            <Field label="Maturidade" htmlFor="f-mat">
              <PillPicker<MaturityKey> id="f-mat" label="Maturidade" value={form.maturity} onChange={(maturity) => up({ maturity })} options={MATURITIES.map((s) => ({ value: s.key, label: s.label }))} />
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Data de início" htmlFor="f-start">
                <Input id="f-start" type="date" value={form.startDate} onChange={(e) => up({ startDate: e.target.value })} />
              </Field>
              <Field label="Data de go-live" htmlFor="f-golive">
                <Input id="f-golive" type="date" value={form.goLiveDate} onChange={(e) => up({ goLiveDate: e.target.value })} />
              </Field>
            </div>
          </Section>

          <Section id="stack" title="Stack" description="Procura na lista ou escreve para adicionar uma opção nova. As novas opções ficam disponíveis para as outras apps.">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Frontend" htmlFor="f-fe">
                <MultiCombobox id="f-fe" value={form.stack.frontend} onChange={(v) => up({ stack: { ...form.stack, frontend: v } })} options={tagSuggestions.frontend} placeholder="React, Vite…" />
              </Field>
              <Field label="Backend" htmlFor="f-be">
                <MultiCombobox id="f-be" value={form.stack.backend} onChange={(v) => up({ stack: { ...form.stack, backend: v } })} options={tagSuggestions.backend} placeholder="Cloud Run, Node.js…" />
              </Field>
              <Field label="Modelos de IA" htmlFor="f-llm">
                <MultiCombobox id="f-llm" value={form.stack.llm} onChange={(v) => up({ stack: { ...form.stack, llm: v } })} options={tagSuggestions.llm} placeholder="Gemini 2.5 Flash…" />
              </Field>
              <Field label="Frameworks de agentes" htmlFor="f-fw">
                <MultiCombobox id="f-fw" value={form.stack.frameworks} onChange={(v) => up({ stack: { ...form.stack, frameworks: v } })} options={tagSuggestions.frameworks} placeholder="Google ADK, MCP…" />
              </Field>
              <Field label="Autenticação" htmlFor="f-auth">
                <Combobox id="f-auth" value={form.stack.auth} onChange={(auth) => up({ stack: { ...form.stack, auth } })} options={infra.auth} />
              </Field>
            </div>
          </Section>

          <Section id="ambientes" title="Ambientes" description="Infraestrutura de cada ambiente. As variáveis e os secrets gerem-se na ficha da app, separador Ambientes.">
            {ENVS.map((env) => {
              const e = form.environments[env.key]
              return (
                <fieldset key={env.key} className={clsx('rounded-xl p-4 transition-colors', e.enabled ? 'srcf' : 'shadow-[inset_0_0_0_1px_var(--hairline-strong)]')}>
                  <legend className="sr-only">{env.label}</legend>
                  <Switch
                    id={`f-${env.key}-enabled`}
                    checked={e.enabled}
                    onChange={(enabled) => upEnv(env.key, { enabled })}
                    label={
                      <span className="font-semibold">
                        {env.label} <span className="font-mono text-[11px] font-normal text-ink-subtle">{env.short}</span>
                      </span>
                    }
                  />
                  {e.enabled ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Tipo de base de dados" htmlFor={`f-${env.key}-dbtype`}>
                        <Combobox id={`f-${env.key}-dbtype`} value={e.dbType} onChange={(dbType) => upEnv(env.key, { dbType })} options={infra.db} />
                      </Field>
                      <Field label="Projeto da BD" htmlFor={`f-${env.key}-dbproj`}>
                        <Input id={`f-${env.key}-dbproj`} value={e.dbProject} onChange={(ev) => upEnv(env.key, { dbProject: ev.target.value })} placeholder="sogrape-ai-studio" spellCheck={false} autoComplete="off" />
                      </Field>
                      <Field label="ID da base de dados" htmlFor={`f-${env.key}-dbid`}>
                        <Input id={`f-${env.key}-dbid`} value={e.dbId} onChange={(ev) => upEnv(env.key, { dbId: ev.target.value })} className="font-mono text-[13px]" spellCheck={false} autoComplete="off" />
                      </Field>
                      <Field label="Alojamento" htmlFor={`f-${env.key}-host`}>
                        <Combobox id={`f-${env.key}-host`} value={e.hosting} onChange={(hosting) => upEnv(env.key, { hosting })} options={infra.hosting} />
                      </Field>
                      <Field label={`URL da app em ${env.short}`} hint="O endereço onde a app corre neste ambiente." htmlFor={`f-${env.key}-appurl`} className="sm:col-span-2">
                        <Input id={`f-${env.key}-appurl`} type="url" value={e.appUrl} onChange={(ev) => upEnv(env.key, { appUrl: ev.target.value })} placeholder="https://" spellCheck={false} />
                      </Field>
                      <Field label="Notas" htmlFor={`f-${env.key}-notes`} className="sm:col-span-2">
                        <Textarea id={`f-${env.key}-notes`} value={e.notes} onChange={(ev) => upEnv(env.key, { notes: ev.target.value })} className="min-h-16" />
                      </Field>
                    </div>
                  ) : null}
                </fieldset>
              )
            })}
          </Section>

          <Section id="repositorio" title="Repositório" description="Opcional. Apps feitas no Google AI Studio podem não ter repositório: escolhe Google AI Studio como conta e deixa o URL vazio.">
            <Field label="URL do repositório" htmlFor="f-repo" hint="Opcional.">
              <Input id="f-repo" type="url" value={form.repo.url} onChange={(e) => { const url = e.target.value; const gh = url.match(/github\.com\/([^/\s]+)/i)?.[1]; up({ repo: { ...form.repo, url, owner: gh ?? form.repo.owner } }) }} placeholder="https://github.com/…" spellCheck={false} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="font-display text-[12px] font-medium text-ink-subtle">Conta</span>
              <Segmented<RepoAccount>
                label="Conta do repositório"
                value={form.repo.account}
                onChange={(v) => up({ repo: { ...form.repo, account: v } })}
                options={REPO_ACCOUNTS.map((r) => ({ value: r.key, label: r.label }))}
                className="w-fit"
              />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Dono no GitHub" htmlFor="f-owner-gh" hint="Preenchido a partir do URL do GitHub.">
                <Input id="f-owner-gh" value={form.repo.owner} onChange={(e) => up({ repo: { ...form.repo, owner: e.target.value } })} placeholder="BrunoJusta" spellCheck={false} autoComplete="off" />
              </Field>
              <Field label="Branch principal" htmlFor="f-branch">
                <Input id="f-branch" value={form.repo.branch} onChange={(e) => up({ repo: { ...form.repo, branch: e.target.value } })} className="font-mono text-[13px]" spellCheck={false} autoComplete="off" />
              </Field>
            </div>
          </Section>

          <Section id="links" title="Links" description="Figma, Google AI Studio, documentação, manual, deck.">
            <Datalist id="link-labels" options={LINK_SUGGESTIONS} />
            {form.links.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
                  <Input aria-label="Nome do link" list="link-labels" value={l.label} onChange={(e) => up({ links: form.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Figma" autoComplete="off" />
                  <Input aria-label="URL do link" type="url" value={l.url} onChange={(e) => up({ links: form.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} placeholder="https://" spellCheck={false} />
                </div>
                <IconButton label="Remover link" onClick={() => up({ links: form.links.filter((_, j) => j !== i) })} className="mt-0.5">
                  <X size={14} aria-hidden />
                </IconButton>
              </div>
            ))}
            <div>
              <Button size="sm" variant="ghost" onClick={() => up({ links: [...form.links, { label: '', url: '' }] })}>
                <Plus size={14} aria-hidden />
                Adicionar link
              </Button>
            </div>
          </Section>

          <Section id="governo" title="Governance">
            <Field label="Product Owner" htmlFor="f-owner" hint="Quem responde pela app do lado do negócio.">
              <PersonInput id="f-owner" value={form.owner} onChange={(p) => up({ owner: p })} />
            </Field>
            <Field label="AI Lead" htmlFor="f-ailead" hint="Quem lidera a parte de IA da app.">
              <PersonInput id="f-ailead" value={form.aiLead} onChange={(p) => up({ aiLead: p })} />
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Switch
                  id="f-gdpr"
                  checked={form.governance.personalData === 'sim'}
                  onChange={(on) => up({ governance: { ...form.governance, personalData: on ? 'sim' : 'nao' } })}
                  label="Trata dados pessoais (RGPD)"
                  description={form.governance.personalData === 'por_avaliar' ? 'Ainda por avaliar. Liga ou desliga para registar.' : undefined}
                />
              </div>
              <Field label="Classificação dos dados" htmlFor="f-class" className="sm:col-span-2">
                <PillPicker<string>
                  id="f-class"
                  label="Classificação dos dados"
                  value={form.governance.dataClassification}
                  onChange={(v) => up({ governance: { ...form.governance, dataClassification: v === form.governance.dataClassification ? '' : v } })}
                  options={[...new Set([...DATA_CLASSIFICATIONS, ...(form.governance.dataClassification ? [form.governance.dataClassification] : [])])].map((c) => ({ value: c, label: c }))}
                />
              </Field>
            </div>
            <Field label="Riscos" htmlFor="f-risks">
              <Textarea id="f-risks" value={form.governance.risks} onChange={(e) => up({ governance: { ...form.governance, risks: e.target.value } })} className="min-h-20" />
            </Field>
            <Field label="Notas" htmlFor="f-gnotes">
              <Textarea id="f-gnotes" value={form.governance.notes} onChange={(e) => up({ governance: { ...form.governance, notes: e.target.value } })} className="min-h-20" />
            </Field>
          </Section>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
        <div className="enter pointer-events-auto flex items-center gap-3 rounded-full bg-surface-1 py-1.5 pr-1.5 pl-4 shadow-panel">
          <span className="hidden font-display text-[13px] font-medium text-ink-subtle sm:inline">{dirty ? 'Alterações por guardar' : 'Sem alterações'}</span>
          <Button variant="ghost" onClick={() => navigate(backTo)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {isNew ? 'Criar app' : 'Guardar'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Sair sem guardar?"
        body="Tens alterações nesta ficha que ainda não foram guardadas. Se saíres, perdes-as."
        confirmLabel="Sair sem guardar"
        danger
      />
    </form>
  )
}
