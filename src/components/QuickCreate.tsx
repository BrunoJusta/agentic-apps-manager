import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { useApps } from '../context/AppsContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { createApp } from '../data/store'
import { emptyApp, isFinished, PRIORITIES, STATUSES } from '../lib/constants'
import type { Person, PriorityKey, StatusKey } from '../lib/types'
import { Button, Dialog, Field, Input } from './ui'
import { Combobox, PillPicker } from './fields'
import { AiLeadPicker } from './people'
import { PriorityIcon } from './AppCard'

type Errors = { name?: string; area?: string; aiLead?: string }

/**
 * Criação rápida: só o essencial para a app entrar no board.
 * O resto (descrição, stack, ambientes, governance) completa-se depois na ficha.
 */
export function QuickCreateDialog({ open, initialStatus, onClose, onCreated }: { open: boolean; initialStatus: StatusKey; onClose: () => void; onCreated: (id: string, name: string) => void }) {
  const { apps } = useApps()
  const { actor } = useAuth()
  const toast = useToast()
  const formId = useId()
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [aiLead, setAiLead] = useState<Person>({ name: '', email: '' })
  const [status, setStatus] = useState<StatusKey>(initialStatus)
  const [priority, setPriority] = useState<PriorityKey>('media')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  // Cada abertura começa limpa, no estado da coluna de onde veio.
  useEffect(() => {
    if (!open) return
    setName('')
    setArea('')
    setAiLead({ name: '', email: '' })
    setStatus(initialStatus)
    setPriority('media')
    setErrors({})
    setSaving(false)
  }, [open, initialStatus])

  const areas = useMemo(() => [...new Set(apps.map((a) => a.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')), [apps])
  const pipeline = STATUSES.filter((s) => !isFinished(s.key))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Errors = {}
    if (!name.trim()) errs.name = 'Dá um nome à app.'
    if (!area.trim()) errs.area = 'Escolhe a área ou escreve uma nova.'
    if (!aiLead.email) errs.aiLead = 'Escolhe quem lidera a parte de IA.'
    setErrors(errs)
    const first = errs.name ? 'qc-name' : errs.area ? 'qc-area' : errs.aiLead ? 'qc-ailead' : null
    if (first) {
      document.getElementById(first)?.focus()
      return
    }
    setSaving(true)
    try {
      const id = await createApp({ ...emptyApp(), name: name.trim(), area: area.trim(), aiLead, status, priority }, actor)
      onCreated(id, name.trim())
    } catch (err) {
      toast(`Não foi possível criar: ${(err as Error).message}`, 'error')
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nova app"
      description="Só o essencial. O resto completa-se depois na ficha."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={saving}>
            {saving ? 'A criar…' : 'Criar app'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="Nome" htmlFor="qc-name" error={errors.name} required>
          <Input
            id="qc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name || undefined}
            aria-describedby={errors.name ? 'qc-name-error' : undefined}
            placeholder="Ex.: Planeamento de Linhas…"
            autoComplete="off"
            // O modal existe para receber este campo.
            autoFocus
          />
        </Field>
        <Field label="Área" htmlFor="qc-area" error={errors.area} required>
          <Combobox id="qc-area" value={area} onChange={setArea} options={areas} placeholder="Procurar ou adicionar área…" />
        </Field>
        <Field label="AI Lead" htmlFor="qc-ailead" error={errors.aiLead} required>
          <AiLeadPicker id="qc-ailead" value={aiLead} onChange={setAiLead} invalid={!!errors.aiLead} describedBy={errors.aiLead ? 'qc-ailead-error' : undefined} />
        </Field>
        <Field label="Estado" htmlFor="qc-status">
          <PillPicker<StatusKey> id="qc-status" label="Estado" value={status} onChange={setStatus} options={pipeline.map((s) => ({ value: s.key, label: s.label, title: s.hint }))} />
        </Field>
        <Field label="Prioridade" htmlFor="qc-prio">
          <PillPicker<PriorityKey>
            id="qc-prio"
            label="Prioridade"
            value={priority}
            onChange={setPriority}
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
      </form>
    </Dialog>
  )
}
