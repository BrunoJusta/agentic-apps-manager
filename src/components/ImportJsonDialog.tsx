import { useMemo, useState } from 'react'
import { normalizeApp, toInput } from '../lib/app-utils'
import { importApps } from '../data/store'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Button, Dialog, Field, Textarea } from './ui'
import type { AppInput } from '../lib/types'

const EXAMPLE = `[
  {
    "name": "Assistente de Rearrolhamento",
    "shortDescription": "Agente que prepara pedidos de rearrolhamento",
    "status": "desenvolvimento",
    "maturity": "piloto",
    "priority": "alta",
    "stack": { "frontend": ["React"], "llm": ["Gemini 2.5 Flash"] },
    "repo": { "url": "https://github.com/...", "account": "sogrape" }
  }
]`

function parse(text: string): { apps: AppInput[]; error: string | null } {
  if (!text.trim()) return { apps: [], error: null }
  try {
    const data = JSON.parse(text)
    const arr = Array.isArray(data) ? data : Array.isArray(data?.apps) ? data.apps : null
    if (!arr) return { apps: [], error: 'O JSON tem de ser uma lista de apps, ou um objeto com "apps".' }
    const apps = arr.map((raw: Record<string, unknown>, i: number) => {
      if (!raw || typeof raw !== 'object' || !String(raw.name ?? '').trim()) throw new Error(`O item ${i + 1} não tem "name".`)
      // nunca importamos campos de sistema nem secrets
      const { id: _id, createdAt: _a, updatedAt: _b, createdBy: _c, updatedBy: _d, secrets: _s, ...rest } = raw
      return toInput(normalizeApp('import', rest))
    })
    return { apps, error: null }
  } catch (e) {
    return { apps: [], error: (e as Error).message.startsWith('O item') ? (e as Error).message : 'JSON inválido. Confirma vírgulas e aspas.' }
  }
}

export function ImportJsonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const { actor } = useAuth()
  const toast = useToast()
  const { apps, error } = useMemo(() => parse(text), [text])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Importar apps a partir de JSON"
      description="Cola uma lista de apps ou carrega um ficheiro .json. Os campos em falta ficam com os valores por defeito. Secrets nunca entram por aqui."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!apps.length || !!error}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const n = await importApps(apps, actor)
                toast(`${n} ${n === 1 ? 'app importada' : 'apps importadas'}.`)
                setText('')
                onClose()
              } catch (e) {
                toast(`A importação parou: ${(e as Error).message}`, 'error')
              } finally {
                setBusy(false)
              }
            }}
          >
            {apps.length ? `Importar ${apps.length}` : 'Importar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Ficheiro" htmlFor="import-file">
          <input
            id="import-file"
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setText(await f.text())
            }}
            className="text-sm text-ink-muted file:mr-3 file:h-8 file:cursor-pointer file:rounded-lg file:border file:border-hairline file:bg-surface-2 file:px-3 file:text-[13px] file:text-ink"
          />
        </Field>
        <Field label="Ou cola o JSON" htmlFor="import-json" error={error}>
          <Textarea
            id="import-json"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            aria-invalid={!!error}
            className="min-h-56 font-mono text-[12px]"
          />
        </Field>
        {apps.length ? (
          <div className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-muted">
            Vão ser criadas: <span className="text-ink">{apps.map((a) => a.name).join(', ')}</span>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
