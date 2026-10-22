import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AppIcon, PriorityIcon } from '../components/AppCard'
import { fileToSquareIcon } from '../lib/image'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowCounterClockwise, ArrowLeft, Cloud, Flag, GitBranch, IdentificationCard, ImageSquare, LinkSimple, Plus, ShieldCheck, Stack as StackIcon, UsersThree, WarningCircle, X } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useApps } from '../context/AppsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { AUTH_OPTIONS, DATA_CLASSIFICATIONS, DB_TYPES, emptyApp, ENVS, HOSTINGS, LINK_SUGGESTIONS, MATURITIES, PRIORITIES, REPO_ACCOUNTS, STACK_SUGGESTIONS, STATUSES } from '../lib/constants'
import { CARD_BLURB_MAX, productionReadiness, toInput } from '../lib/app-utils'
import { createApp, updateApp } from '../data/store'
import type { AppInput, EnvKey, Environment, MaturityKey, PriorityKey, RepoAccount, StatusKey } from '../lib/types'
import { Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Segmented, Skeleton, Textarea } from '../components/ui'
import { Combobox, MultiCombobox, PillPicker, Switch } from '../components/fields'
import { AiLeadPicker, EmailPersonInput } from '../components/people'

const SECTIONS: { id: string; label: string; icon: Icon }[] = [
  { id: 'identidade', label: 'Identidade', icon: IdentificationCard },
  { id: 'estado', label: 'Estado', icon: Flag },
  { id: 'pessoas', label: 'Pessoas', icon: UsersThree },
  { id: 'stack', label: 'Stack', icon: StackIcon },
  { id: 'ambientes', label: 'Ambientes', icon: Cloud },
  { id: 'repositorio', label: 'Repositório', icon: GitBranch },
  { id: 'links', label: 'Links', icon: LinkSimple },
  { id: 'governo', label: 'Governance', icon: ShieldCheck },
]

type Errors = { name?: string; area?: string; aiLead?: string; owner?: string; prod?: string[] }

const draftKey = (id: string | undefined) => `agentic-hub:draft:${id ?? 'nova'}`
const readDraft = (key: string): AppInput | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as AppInput) : null
  } catch {
    return null
  }
}
const writeDraft = (key: string, v: AppInput | null) => {
  try {
    if (v) localStorage.setItem(key, JSON.stringify(v))
    else localStorage.removeItem(key)
  } catch {
    /* sem armazenamento: o rascunho é só uma conveniência */
  }
}

function Section({ id, icon: I, title, description, children }: { id: string; icon: Icon; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[168px] rounded-card bg-surface-1 p-5 shadow-e2 min-[860px]:scroll-mt-[96px] sm:p-7">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">
          <I size={16} />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-display text-[18px] leading-7 font-semibold tracking-[-0.025em] text-balance text-ink sm:text-[20px]">
            {title}
          </h2>
          {description ? <p className="mt-0.5 max-w-[60ch] text-[13.5px] text-pretty text-ink-subtle">{description}</p> : null}
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
  )
}

function IconPicker({ value, name, area, onChange }: { value: string; name: string; area: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={value ? 'Trocar ícone da app' : 'Carregar ícone da app'}
        className="group relative shrink-0 rounded-[18px] transition-transform active:scale-[0.97]"
      >
        <AppIcon app={{ name: name || '?', icon: value, area }} size={64} />
        <span aria-hidden className="absolute inset-0 flex items-center justify-center rounded-[16px] bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ImageSquare size={20} />
        </span>
      </button>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            {value ? 'Trocar ícone' : 'Carregar ícone'}
          </Button>
          {value ? (
            <Button size="sm" variant="ghost" onClick={() => onChange('')}>
              Remover
            </Button>
          ) : null}
        </div>
        <p className={err ? 'text-[12px] text-danger' : 'text-[12px] text-ink-tertiary'}>{err ?? 'Quadrado, de preferência. Fica com 256×256.'}</p>
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

/** Descrição com contador: os primeiros caracteres aparecem no cartão do board. */
function DescriptionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const len = value.replace(/\s+/g, ' ').trim().length
  return (
    <Field
      label="Descrição"
      htmlFor="f-desc"
      hint={
        <span className="tabular">
          {len ? `${len} caracteres. ` : ''}
          {len > CARD_BLURB_MAX ? `O cartão mostra os primeiros ${CARD_BLURB_MAX}.` : `Os primeiros ${CARD_BLURB_MAX} aparecem no cartão do board.`}
        </span>
      }
    >
      <Textarea id="f-desc" value={value} onChange={(e) => onChange(e.target.value)} placeholder="O que faz, para quem, e que problema resolve…" className="min-h-32" />
    </Field>
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

/** Conta do repositório deduzida do URL, quando dá para saber. */
function accountFromUrl(url: string): RepoAccount | null {
  if (/aistudio\.google\.com/i.test(url)) return 'ai_studio'
  return null
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
  const key = draftKey(id)

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
  const [errors, setErrors] = useState<Errors>({})
  const [draft, setDraft] = useState<AppInput | null>(null)

  useEffect(() => {
    if (!form && initial) setForm(initial)
  }, [initial, form])

  // Rascunho local: se a página fechou com alterações por guardar, oferece recuperá-las.
  const initialReady = !!initial
  useEffect(() => {
    if (!initial) return
    const d = readDraft(key)
    if (d && JSON.stringify(d) !== JSON.stringify(initial)) setDraft(d)
    else writeDraft(key, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReady, key])

  const dirty = !!form && !!initial && JSON.stringify(form) !== JSON.stringify(initial)

  useEffect(() => {
    if (!form || draft) return
    const t = window.setTimeout(() => writeDraft(key, dirty ? form : null), 400)
    return () => window.clearTimeout(t)
  }, [form, dirty, key, draft])

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !saving && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // A barra de guardar é fixa em baixo: o campo com foco nunca fica por trás dela.
  useEffect(() => {
    const el = document.documentElement
    el.style.scrollPaddingBottom = '120px'
    return () => {
      el.style.scrollPaddingBottom = ''
    }
  }, [])

  const tagSuggestions = useMemo(
    () => ({
      frontend: [...new Set([...STACK_SUGGESTIONS.frontend, ...apps.flatMap((a) => a.stack.frontend)])],
      backend: [...new Set([...STACK_SUGGESTIONS.backend, ...apps.flatMap((a) => a.stack.backend)])],
      llm: [...new Set([...STACK_SUGGESTIONS.llm, ...apps.flatMap((a) => a.stack.llm)])],
      frameworks: [...new Set([...STACK_SUGGESTIONS.frameworks, ...apps.flatMap((a) => a.stack.frameworks)])],
    }),
    [apps],
  )
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

  // Mantém o separador ativo visível na navegação horizontal (telemóvel).
  useEffect(() => {
    document.getElementById(`chip-${activeSection}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeSection])

  if (!canEdit) return <EmptyState title="Só Editors e Admins podem editar fichas." action={<Link to="/" className="text-accent-text underline">Voltar ao board</Link>} />
  if (!isNew && !loading && !existing) return <EmptyState title="Esta app não existe ou foi apagada." action={<Link to="/" className="text-accent-text underline">Voltar ao board</Link>} />
  if (!form) {
    return (
      <div className="flex flex-col gap-3 py-10" role="status" aria-label="A carregar">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </div>
    )
  }

  const up = (patch: Partial<AppInput>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const upEnv = (k: EnvKey, patch: Partial<Environment>) => setForm((f) => (f ? { ...f, environments: { ...f.environments, [k]: { ...f.environments[k], ...patch } } } : f))
  const clearError = (k: keyof Errors) => errors[k] && setErrors((e) => ({ ...e, [k]: undefined }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!form.name.trim()) errs.name = 'Dá um nome à app.'
    if (!form.area.trim()) errs.area = 'Escolhe a área ou escreve uma nova.'
    if (!form.aiLead.email) errs.aiLead = 'Escolhe quem lidera a parte de IA.'
    if (form.status === 'producao') {
      const r = productionReadiness(form)
      if (!r.items[0].ok) errs.owner = 'Para estar em Production, a app precisa de Product Owner.'
      const prodMissing = r.items.slice(1).filter((i) => !i.ok).map((i) => i.label)
      if (prodMissing.length) errs.prod = prodMissing
    }
    setErrors(errs)
    const first = errs.name ? 'f-name' : errs.area ? 'f-area' : errs.aiLead ? 'f-ailead' : errs.owner ? 'f-owner' : errs.prod ? 'env-prod' : null
    if (first) {
      const el = document.getElementById(first)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus({ preventScroll: true })
      return
    }
    setSaving(true)
    try {
      const gh = form.repo.url.match(/github\.com\/([^/\s]+)/i)?.[1]
      const clean: AppInput = {
        ...form,
        name: form.name.trim(),
        area: form.area.trim(),
        links: form.links.filter((l) => l.url.trim()),
        repo: { ...form.repo, owner: gh ?? form.repo.owner, branch: form.repo.branch || 'main' },
      }
      if (isNew) {
        const newId = await createApp(clean, actor)
        writeDraft(key, null)
        toast('App criada.')
        navigate(`/apps/${newId}`, { replace: true })
      } else {
        await updateApp(id!, initial!, clean, actor)
        writeDraft(key, null)
        toast('Alterações guardadas.')
        navigate(`/apps/${id}`)
      }
    } catch (err) {
      toast(`Não foi possível guardar: ${(err as Error).message}. Tenta outra vez; as alterações continuam aqui.`, 'error')
      setSaving(false)
    }
  }

  const backTo = isNew ? '/' : `/apps/${id}`
  const prodEnvError = errors.prod?.length ? `Para estar em Production falta: ${errors.prod.join(', ').toLowerCase()}.` : null

  return (
    <form onSubmit={submit} noValidate className="pb-36">
      <div className="pt-8 pb-6">
        <Link to={backTo} className="inline-flex items-center gap-1 rounded-full font-display text-[13px] font-medium text-ink-subtle hover:text-ink">
          <ArrowLeft size={14} aria-hidden />
          {isNew ? 'Lifecycle Management' : initial?.name}
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <AppIcon app={{ name: form.name || '?', icon: form.icon, area: form.area }} size={48} className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-[26px] leading-8 font-semibold tracking-[-0.03em] text-ink min-[760px]:text-[32px] min-[760px]:leading-10">{isNew ? 'Nova app' : form.name || 'Editar ficha'}</h1>
            <p className="mt-0.5 text-[13.5px] text-ink-subtle">
              Os campos com <span className="text-danger">*</span> são obrigatórios. O resto preenche-se quando houver informação.
            </p>
          </div>
        </div>
      </div>

      {draft ? (
        <div role="status" className="enter mb-5 flex flex-wrap items-center gap-3 rounded-card bg-warning-soft px-4 py-3 text-sm text-ink shadow-[0_0_0_1px_color-mix(in_srgb,var(--warn)_35%,transparent)]">
          <ArrowCounterClockwise size={16} className="shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1">Há alterações que não chegaste a guardar nesta ficha.</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                writeDraft(key, null)
                setDraft(null)
              }}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setForm(draft)
                setDraft(null)
              }}
            >
              Recuperar
            </Button>
          </div>
        </div>
      ) : null}

      {/* Navegação por secções em telemóvel: tira horizontal fixa. */}
      <nav aria-label="Secções do formulário" className="scroll-x sticky top-[104px] z-20 -mx-4 mb-4 flex gap-1.5 overflow-x-auto bg-canvas/90 px-4 py-2 backdrop-blur-[10px] min-[860px]:hidden">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            id={`chip-${s.id}`}
            href={`#${s.id}`}
            aria-current={activeSection === s.id ? 'true' : undefined}
            className={clsx(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 font-display text-[13px] font-medium transition-colors',
              activeSection === s.id ? 'bg-ink text-canvas' : 'bg-surface-1 text-ink-muted shadow-ring',
            )}
          >
            <s.icon size={14} aria-hidden />
            {s.label}
          </a>
        ))}
      </nav>

      <div className="flex gap-8">
        <nav aria-label="Secções do formulário" className="sticky top-[84px] hidden h-fit w-[200px] shrink-0 flex-col gap-0.5 min-[860px]:flex">
          {SECTIONS.map((s) => {
            const hasError =
              (s.id === 'identidade' && (errors.name || errors.area)) || (s.id === 'pessoas' && (errors.aiLead || errors.owner)) || (s.id === 'ambientes' && errors.prod?.length)
            return (
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
                <span className="flex-1">{s.label}</span>
                {hasError ? <WarningCircle size={15} weight="fill" className="text-danger" aria-label="Tem erros" /> : null}
              </a>
            )
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Section id="identidade" icon={IdentificationCard} title="Identidade">
            <IconPicker value={form.icon} name={form.name} area={form.area} onChange={(icon) => up({ icon })} />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Nome" htmlFor="f-name" error={errors.name} required>
                <Input
                  id="f-name"
                  value={form.name}
                  onChange={(e) => {
                    up({ name: e.target.value })
                    clearError('name')
                  }}
                  aria-invalid={!!errors.name || undefined}
                  aria-describedby={errors.name ? 'f-name-error' : undefined}
                  placeholder="Ex.: Planeamento de Linhas…"
                  autoComplete="off"
                />
              </Field>
              <Field label="Área" htmlFor="f-area" error={errors.area} required>
                <Combobox
                  id="f-area"
                  value={form.area}
                  onChange={(area) => {
                    up({ area })
                    clearError('area')
                  }}
                  options={areas}
                  placeholder="Procurar ou adicionar área…"
                />
              </Field>
            </div>
            <DescriptionField value={form.description} onChange={(description) => up({ description })} />
          </Section>

          <Section id="estado" icon={Flag} title="Estado" description="Onde está a app, quão madura é e quando arrancou.">
            <Field label="Estado" htmlFor="f-status">
              <PillPicker<StatusKey> id="f-status" label="Estado" value={form.status} onChange={(status) => up({ status })} options={STATUSES.map((s) => ({ value: s.key, label: s.label, title: s.hint }))} />
            </Field>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Field label="Maturidade" htmlFor="f-mat">
                <PillPicker<MaturityKey> id="f-mat" label="Maturidade" value={form.maturity} onChange={(maturity) => up({ maturity })} options={MATURITIES.map((s) => ({ value: s.key, label: s.label }))} />
              </Field>
              <Field label="Prioridade" htmlFor="f-prio">
                <PillPicker<PriorityKey>
                  id="f-prio"
                  label="Prioridade"
                  value={form.priority}
                  onChange={(priority) => up({ priority })}
                  options={[...PRIORITIES].reverse().map((p) => ({
                    value: p.key,
                    label: (
                      <>
                        <PriorityIcon priority={p.key} />
                        {p.label}
                      </>
                    ),
                  }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Data de início" htmlFor="f-start">
                <Input id="f-start" type="date" value={form.startDate} onChange={(e) => up({ startDate: e.target.value })} />
              </Field>
              <Field label="Data de go-live" htmlFor="f-golive">
                <Input id="f-golive" type="date" value={form.goLiveDate} min={form.startDate || undefined} onChange={(e) => up({ goLiveDate: e.target.value })} />
              </Field>
            </div>
          </Section>

          <Section id="pessoas" icon={UsersThree} title="Pessoas" description="Quem lidera a IA e quem responde pela app do lado do negócio.">
            <Field label="AI Lead" htmlFor="f-ailead" error={errors.aiLead} hint="Editors e Admins de Access Control." required>
              <AiLeadPicker
                id="f-ailead"
                value={form.aiLead}
                onChange={(aiLead) => {
                  up({ aiLead })
                  clearError('aiLead')
                }}
                invalid={!!errors.aiLead}
                describedBy={errors.aiLead ? 'f-ailead-error' : 'f-ailead-hint'}
              />
            </Field>
            <Field label="Product Owner" htmlFor="f-owner" error={errors.owner} hint="Escreve o email; o nome preenche-se sozinho e podes corrigi-lo.">
              <EmailPersonInput
                id="f-owner"
                value={form.owner}
                onChange={(owner) => {
                  up({ owner })
                  clearError('owner')
                }}
                invalid={!!errors.owner}
                describedBy={errors.owner ? 'f-owner-error' : 'f-owner-hint'}
              />
            </Field>
          </Section>

          <Section id="stack" icon={StackIcon} title="Stack" description="Procura na lista ou escreve para adicionar. O que adicionares fica disponível para as outras apps.">
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

          <Section id="ambientes" icon={Cloud} title="Ambientes" description="Liga os ambientes que existem. Variáveis e secrets ligam-se na ficha da app.">
            {ENVS.map((env) => {
              const e = form.environments[env.key]
              const err = env.key === 'prod' ? prodEnvError : null
              return (
                <fieldset
                  key={env.key}
                  id={`env-${env.key}`}
                  tabIndex={-1}
                  aria-describedby={err ? 'env-prod-error' : undefined}
                  className={clsx(
                    'rounded-xl p-4 outline-none transition-[background-color,box-shadow] duration-200',
                    err ? 'shadow-[inset_0_0_0_1px_var(--danger)]' : e.enabled ? 'srcf' : 'shadow-[inset_0_0_0_1px_var(--hairline)]',
                  )}
                >
                  <legend className="sr-only">{env.label}</legend>
                  <Switch
                    id={`f-${env.key}-enabled`}
                    checked={e.enabled}
                    onChange={(enabled) => {
                      upEnv(env.key, { enabled })
                      if (env.key === 'prod') clearError('prod')
                    }}
                    label={
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="tg mn">{env.short}</span>
                        {env.label}
                      </span>
                    }
                    description={e.enabled ? undefined : 'Desligado. Liga para descrever este ambiente.'}
                  />
                  {err ? (
                    <p id="env-prod-error" role="alert" className="mt-3 text-[12.5px] text-danger">
                      {err}
                    </p>
                  ) : null}
                  {e.enabled ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Alojamento" htmlFor={`f-${env.key}-host`}>
                        <Combobox id={`f-${env.key}-host`} value={e.hosting} onChange={(hosting) => upEnv(env.key, { hosting })} options={infra.hosting} />
                      </Field>
                      <Field label="Tipo de base de dados" htmlFor={`f-${env.key}-dbtype`}>
                        <Combobox id={`f-${env.key}-dbtype`} value={e.dbType} onChange={(dbType) => upEnv(env.key, { dbType })} options={infra.db} />
                      </Field>
                      <Field label={`URL da app em ${env.short}`} htmlFor={`f-${env.key}-appurl`} className="sm:col-span-2">
                        <Input id={`f-${env.key}-appurl`} type="url" inputMode="url" value={e.appUrl} onChange={(ev) => upEnv(env.key, { appUrl: ev.target.value })} placeholder="https://…" spellCheck={false} autoComplete="off" />
                      </Field>
                      <Field label="Projeto da BD" htmlFor={`f-${env.key}-dbproj`}>
                        <Input id={`f-${env.key}-dbproj`} value={e.dbProject} onChange={(ev) => upEnv(env.key, { dbProject: ev.target.value })} placeholder="sogrape-ai-studio…" spellCheck={false} autoComplete="off" />
                      </Field>
                      <Field label="ID da base de dados" htmlFor={`f-${env.key}-dbid`}>
                        <Input id={`f-${env.key}-dbid`} value={e.dbId} onChange={(ev) => upEnv(env.key, { dbId: ev.target.value })} className="font-mono text-[13px]" spellCheck={false} autoComplete="off" />
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

          <Section id="repositorio" icon={GitBranch} title="Repositório" description="Opcional. Apps do Google AI Studio podem não ter repositório: escolhe Google AI Studio e deixa o URL vazio.">
            <Field label="URL do repositório" htmlFor="f-repo">
              <Input
                id="f-repo"
                type="url"
                inputMode="url"
                value={form.repo.url}
                onChange={(e) => {
                  const url = e.target.value
                  const acc = accountFromUrl(url)
                  up({ repo: { ...form.repo, url, account: acc ?? form.repo.account } })
                }}
                placeholder="https://github.com/…"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="font-display text-[12.5px] font-medium text-ink-muted">Conta</span>
              <Segmented<RepoAccount>
                label="Conta do repositório"
                value={form.repo.account}
                onChange={(v) => up({ repo: { ...form.repo, account: v } })}
                options={REPO_ACCOUNTS.map((r) => ({ value: r.key, label: r.label }))}
                className="w-fit"
              />
            </div>
          </Section>

          <Section id="links" icon={LinkSimple} title="Links" description="Figma, Google AI Studio, documentação, manual, deck.">
            <Datalist id="link-labels" options={LINK_SUGGESTIONS} />
            {form.links.length ? (
              <div className="flex flex-col gap-2">
                {form.links.map((l, i) => (
                  <div key={i} className="enter flex items-start gap-2">
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
                      <Input aria-label={`Nome do link ${i + 1}`} list="link-labels" value={l.label} onChange={(e) => up({ links: form.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Figma…" autoComplete="off" />
                      <Input aria-label={`URL do link ${i + 1}`} type="url" inputMode="url" value={l.url} onChange={(e) => up({ links: form.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} placeholder="https://…" spellCheck={false} autoComplete="off" />
                    </div>
                    <IconButton label={`Remover link ${l.label || i + 1}`} onClick={() => up({ links: form.links.filter((_, j) => j !== i) })} className="mt-1">
                      <X size={14} aria-hidden />
                    </IconButton>
                  </div>
                ))}
              </div>
            ) : null}
            <div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  up({ links: [...form.links, { label: '', url: '' }] })
                  window.setTimeout(() => document.querySelector<HTMLInputElement>(`[aria-label="Nome do link ${form.links.length + 1}"]`)?.focus(), 0)
                }}
              >
                <Plus size={14} aria-hidden />
                Adicionar link
              </Button>
            </div>
          </Section>

          <Section id="governo" icon={ShieldCheck} title="Governance">
            <div className="rounded-xl p-4 shadow-[inset_0_0_0_1px_var(--hairline)]">
              <Switch
                id="f-gdpr"
                checked={form.governance.personalData === 'sim'}
                onChange={(on) => up({ governance: { ...form.governance, personalData: on ? 'sim' : 'nao' } })}
                label="Trata dados pessoais (RGPD)"
                description={form.governance.personalData === 'por_avaliar' ? 'Ainda por avaliar. Liga ou desliga para registar.' : undefined}
              />
            </div>
            <Field label="Classificação dos dados" htmlFor="f-class">
              <PillPicker<string>
                id="f-class"
                label="Classificação dos dados"
                value={form.governance.dataClassification}
                onChange={(v) => up({ governance: { ...form.governance, dataClassification: v === form.governance.dataClassification ? '' : v } })}
                options={[...new Set([...DATA_CLASSIFICATIONS, ...(form.governance.dataClassification ? [form.governance.dataClassification] : [])])].map((c) => ({ value: c, label: c }))}
              />
            </Field>
            <Field label="Observações" htmlFor="f-obs" hint="Riscos, dependências, decisões, o que for útil saber.">
              <Textarea id="f-obs" value={form.governance.notes} onChange={(e) => up({ governance: { ...form.governance, notes: e.target.value } })} className="min-h-28" />
            </Field>
          </Section>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[max(20px,env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
        <div className="enter pointer-events-auto flex items-center gap-2 rounded-full bg-surface-1 py-1.5 pr-1.5 pl-1.5 shadow-panel">
          {dirty ? (
            <span className="hidden items-center gap-2 pr-1 pl-3 font-display text-[13px] font-medium text-ink-subtle sm:flex">
              <span aria-hidden className="size-1.5 rounded-full bg-warning" />
              Alterações por guardar
            </span>
          ) : null}
          <Button variant="ghost" onClick={() => navigate(backTo)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            {saving ? 'A guardar…' : isNew ? 'Criar app' : 'Guardar alterações'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => {
          writeDraft(key, null)
          blocker.proceed?.()
        }}
        title="Sair sem guardar?"
        body="Tens alterações nesta ficha que ainda não foram guardadas. Se saíres, perdes-as."
        confirmLabel="Sair sem guardar"
        danger
      />
    </form>
  )
}
