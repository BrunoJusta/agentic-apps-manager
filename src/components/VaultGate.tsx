import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Fingerprint, Key, LockKey, LockKeyOpen, ShieldWarning, Sparkle } from '@phosphor-icons/react'
import { useVault } from '../context/VaultContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { passphraseProblems, WrongPassphraseError } from '../lib/crypto'
import { AUTO_LOCK_MINUTES } from '../lib/constants'
import { Button, Dialog, Field, Input, Panel, Spinner } from './ui'

function PassphraseCreate({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: (p: string) => Promise<void> }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const problem = p1 ? passphraseProblems(p1) : null
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const pr = passphraseProblems(p1)
    if (pr) return setErr(pr)
    if (p1 !== p2) return setErr('As duas passphrases não são iguais.')
    setErr(null)
    setBusy(true)
    try {
      await onSubmit(p1)
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Passphrase pessoal" htmlFor="pp1" hint={problem ?? 'Só tu a sabes. Não é a password da Microsoft e não fica guardada em lado nenhum.'}>
        <Input id="pp1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} spellCheck={false} />
      </Field>
      <Field label="Repetir passphrase" htmlFor="pp2" error={err}>
        <Input id="pp2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'pp2-error' : undefined} spellCheck={false} />
      </Field>
      <p className="notice warn text-[13px]">
        Se te esqueceres da passphrase, ninguém a consegue recuperar. Um Admin terá de te dar acesso outra vez depois de criares chaves novas.
      </p>
      <div>
        <Button type="submit" variant="primary" loading={busy}>
          {submitLabel}
        </Button>
      </div>
      {busy ? <p className="text-xs text-ink-subtle">A gerar chaves no teu browser. Pode demorar uns segundos.</p> : null}
    </form>
  )
}

function UnlockForm({ onDone }: { onDone?: () => void }) {
  const { unlock } = useVault()
  const [p, setP] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!p) return
    setBusy(true)
    setErr(null)
    try {
      await unlock(p)
      setP('')
      onDone?.()
    } catch (e2) {
      setErr(e2 instanceof WrongPassphraseError ? 'Passphrase incorreta.' : (e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Passphrase" htmlFor="unlock-pp" error={err} hint={`O cofre volta a bloquear após ${AUTO_LOCK_MINUTES} minutos sem atividade.`}>
        <Input id="unlock-pp" type="password" autoComplete="current-password" autoFocus value={p} onChange={(e) => setP(e.target.value)} aria-invalid={!!err} aria-describedby={err ? 'unlock-pp-error' : 'unlock-pp-hint'} spellCheck={false} />
      </Field>
      <div>
        <Button type="submit" variant="primary" loading={busy} disabled={!p}>
          {busy ? null : <LockKeyOpen size={16} aria-hidden />}
          Desbloquear
        </Button>
      </div>
    </form>
  )
}

export function UnlockBurst() {
  return (
    <span className="relative inline-flex size-10 items-center justify-center" aria-hidden>
      <span className="unlock-ring absolute inset-0 rounded-full border-2 border-success" />
      <span className="unlock-pop inline-flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
        <LockKeyOpen size={22} weight="bold" />
      </span>
    </span>
  )
}

/** Cartão completo com o estado do cofre e a ação seguinte certa para o utilizador. */
export function VaultStatusCard({ compact }: { compact?: boolean }) {
  const vault = useVault()
  const { isAdmin } = useAuth()
  const toast = useToast()

  const shell = (icon: React.ReactNode, title: string, body: React.ReactNode, children?: React.ReactNode, tone: 'neutral' | 'warning' = 'neutral') => (
    <Panel className={clsx('p-5', compact ? '' : 'md:p-6')}>
      <div className="flex items-start gap-4">
        <span className={clsx('inline-flex size-10 shrink-0 items-center justify-center rounded-full', tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-ink')} aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
          <div className="mt-1 max-w-[65ch] text-sm text-ink-muted">{body}</div>
          {children ? <div className="mt-5 max-w-md">{children}</div> : null}
        </div>
      </div>
    </Panel>
  )

  switch (vault.status) {
    case 'unavailable':
      return shell(<LockKey size={20} />, 'Sem acesso aos secrets', 'O teu papel é Viewer. Vês as fichas e as variáveis, mas os secrets ficam fora de alcance.')
    case 'loading':
      return (
        <Panel className="flex items-center gap-3 p-5 text-sm text-ink-subtle" >
          <Spinner /> A verificar o cofre…
        </Panel>
      )
    case 'not-initialized':
      return isAdmin
        ? shell(
            <Sparkle size={20} />,
            'Inicializar o cofre',
            'Ainda não existe chave do cofre. Ao inicializar, o teu browser gera a chave, cifra-a para ti, e ficas com o cofre aberto. Usa a tua passphrase pessoal (se ainda não tens chaves, são criadas agora).',
            vault.myKeys ? (
              <UnlockLikeInit />
            ) : (
              <PassphraseCreate
                submitLabel="Criar chaves e inicializar"
                onSubmit={async (p) => {
                  await vault.initialize(p)
                  toast('Cofre inicializado e aberto.')
                }}
              />
            ),
          )
        : shell(<LockKey size={20} />, 'O cofre ainda não foi inicializado', 'Um Admin tem de o inicializar primeiro. Entretanto podes criar as tuas chaves pessoais para ficares pronto.', vault.myKeys ? null : <PassphraseCreate submitLabel="Criar as minhas chaves" onSubmit={vault.createKeys} />)
    case 'no-keys':
      return shell(
        <Key size={20} />,
        'Cria as tuas chaves pessoais',
        'Para veres secrets precisas de um par de chaves só teu, protegido por uma passphrase. Depois um Admin dá-te acesso ao cofre.',
        <PassphraseCreate
          submitLabel="Criar as minhas chaves"
          onSubmit={async (p) => {
            await vault.createKeys(p)
            toast('Chaves criadas. Agora pede acesso a um Admin.')
          }}
        />,
      )
    case 'no-grant':
    case 'stale-grant':
      return shell(
        <Fingerprint size={20} />,
        vault.status === 'no-grant' ? 'À espera de acesso' : 'O teu acesso precisa de ser renovado',
        <>
          {vault.status === 'no-grant'
            ? 'As tuas chaves estão criadas. Pede a um Admin para te dar acesso ao cofre.'
            : 'A chave do cofre foi rodada e o teu acesso é da versão anterior. Pede a um Admin para te dar acesso outra vez.'}{' '}
          Para confirmarem que é mesmo a tua chave, diz-lhes a impressão digital:
          <span className="tg mn mt-3 w-fit px-3 py-1.5 text-[13px] tracking-wider text-ink">{vault.myKeys?.fingerprint}</span>
        </>,
        <ResetKeysLink />,
        'warning',
      )
    case 'locked':
      return shell(<LockKey size={20} />, 'Cofre bloqueado', 'Escreve a tua passphrase pessoal para veres e copiares secrets nesta sessão.', <UnlockForm onDone={() => toast('Cofre aberto.')} />)
    case 'unlocked':
      return shell(
        <UnlockBurst />,
        'Cofre aberto',
        `Podes revelar, copiar e exportar secrets. Bloqueia sozinho após ${AUTO_LOCK_MINUTES} minutos sem atividade.`,
        <Button onClick={vault.lock}>
          <LockKey size={16} aria-hidden />
          Bloquear agora
        </Button>,
      )
  }
}

function UnlockLikeInit() {
  const vault = useVault()
  const toast = useToast()
  const [p, setP] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr(null)
        try {
          await vault.initialize(p)
          toast('Cofre inicializado e aberto.')
        } catch (e2) {
          setErr(e2 instanceof WrongPassphraseError ? 'Passphrase incorreta.' : (e2 as Error).message)
        } finally {
          setBusy(false)
        }
      }}
      className="flex flex-col gap-3"
    >
      <Field label="A tua passphrase pessoal" htmlFor="init-pp" error={err}>
        <Input id="init-pp" type="password" autoComplete="current-password" value={p} onChange={(e) => setP(e.target.value)} aria-invalid={!!err} spellCheck={false} />
      </Field>
      <div>
        <Button type="submit" variant="primary" loading={busy} disabled={!p}>
          Inicializar cofre
        </Button>
      </div>
    </form>
  )
}

function ResetKeysLink() {
  const vault = useVault()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] text-ink-subtle underline underline-offset-4 hover:text-ink">
        Esqueci-me da passphrase
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Criar chaves novas?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                await vault.resetMyKeys()
                setBusy(false)
                setOpen(false)
              }}
            >
              Apagar as minhas chaves
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">As tuas chaves atuais e o teu acesso ao cofre são apagados. Depois crias chaves novas e um Admin dá-te acesso outra vez. Os secrets não se perdem.</p>
      </Dialog>
    </>
  )
}

/** Diálogo pequeno para desbloquear a partir de qualquer ecrã. */
export function UnlockDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vault = useVault()
  const ready = vault.status === 'locked'
  return (
    <Dialog open={open} onClose={onClose} title="Desbloquear o cofre" size="sm" description={ready ? undefined : 'Ainda falta um passo antes de poderes ver secrets.'}>
      {ready ? (
        <UnlockForm onDone={onClose} />
      ) : (
        <div className="flex items-start gap-2 text-sm text-ink-muted">
          <ShieldWarning size={18} className="mt-px shrink-0 text-warning" aria-hidden />
          <span>
            Vai à página <Link to="/cofre" onClick={onClose} className="text-accent-text underline underline-offset-2">Cofre</Link> para ver o que falta.
          </span>
        </div>
      )}
    </Dialog>
  )
}
