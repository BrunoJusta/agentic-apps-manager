import type {
  RequestStatus,
  RequestType,
  AppInput,
  EnvKey,
  Environment,
  MaturityKey,
  PersonalData,
  PriorityKey,
  RepoAccount,
  Role,
  SecretType,
  StatusKey,
} from './types'

export const BOOTSTRAP_ADMIN = (import.meta.env.VITE_BOOTSTRAP_ADMIN || 'bruno.justa@sogrape.pt').toLowerCase()
export const ALLOWED_DOMAIN = '@sogrape.pt'
export const AUTO_LOCK_MINUTES = 15
export const REVEAL_SECONDS = 30
export const ROTATION_WARNING_DAYS = 30

export const STATUSES: { key: StatusKey; label: string; hint: string }[] = [
  { key: 'ideia', label: 'Ideia', hint: 'Pedido ou oportunidade identificada' },
  { key: 'discovery', label: 'Discovery', hint: 'Levantamento com o negócio e protótipo' },
  { key: 'desenvolvimento', label: 'Em desenvolvimento', hint: 'Construção ativa' },
  { key: 'qa', label: 'QA / UAT', hint: 'Testes com utilizadores-chave' },
  { key: 'producao', label: 'Produção', hint: 'Em uso real. Alterações e novos módulos registam-se como pedidos na ficha.' },
  { key: 'descontinuada', label: 'Descontinuada', hint: 'Desligada ou substituída' },
]

/** Fases que saem do board e vivem na tab Finalizadas. */
export const FINISHED_STATUSES: StatusKey[] = ['producao', 'descontinuada']
export const isFinished = (s: StatusKey) => FINISHED_STATUSES.includes(s)

export const MATURITIES: { key: MaturityKey; label: string }[] = [
  { key: 'poc', label: 'PoC' },
  { key: 'piloto', label: 'Piloto' },
  { key: 'mvp', label: 'MVP' },
  { key: 'estavel', label: 'Estável' },
  { key: 'escala', label: 'Escala' },
]

export const PRIORITIES: { key: PriorityKey; label: string; rank: number }[] = [
  { key: 'critica', label: 'Crítica', rank: 0 },
  { key: 'alta', label: 'Alta', rank: 1 },
  { key: 'media', label: 'Média', rank: 2 },
  { key: 'baixa', label: 'Baixa', rank: 3 },
]

export const ENVS: { key: EnvKey; label: string; short: string }[] = [
  { key: 'dev', label: 'Desenvolvimento', short: 'DEV' },
  { key: 'qa', label: 'Qualidade', short: 'QA' },
  { key: 'prod', label: 'Produção', short: 'PROD' },
]

export const REPO_ACCOUNTS: { key: RepoAccount; label: string }[] = [
  { key: 'sogrape', label: 'Organização Sogrape' },
  { key: 'pessoal', label: 'Conta pessoal' },
  { key: 'ai_studio', label: 'Google AI Studio' },
]

export const PERSONAL_DATA: { key: PersonalData; label: string }[] = [
  { key: 'por_avaliar', label: 'Por avaliar' },
  { key: 'sim', label: 'Sim, trata dados pessoais' },
  { key: 'nao', label: 'Não' },
]

export const ROLES: { key: Role; label: string; hint: string }[] = [
  { key: 'admin', label: 'Admin', hint: 'Gere utilizadores, cofre e tudo o resto' },
  { key: 'editor', label: 'Editor', hint: 'Cria e edita apps; pode receber acesso aos secrets' },
  { key: 'viewer', label: 'Viewer', hint: 'Vê o board e as fichas, nunca os secrets' },
]

export const SECRET_TYPES: { key: SecretType; label: string }[] = [
  { key: 'api_key', label: 'API key' },
  { key: 'token', label: 'Token' },
  { key: 'password', label: 'Password' },
  { key: 'connection_string', label: 'Connection string' },
  { key: 'service_account', label: 'Service account (JSON)' },
  { key: 'other', label: 'Outro' },
]

export const DB_TYPES = ['Firestore', 'Firebase Realtime DB', 'Supabase (Postgres)', 'Cloud SQL', 'Azure SQL', 'SQL Server', 'BigQuery', 'Google Sheets', 'SharePoint List', 'Nenhuma']
export const HOSTINGS = ['Vercel', 'Firebase Hosting', 'Cloud Run', 'Google AI Studio', 'Azure App Service', 'Azure Static Web Apps', 'Netlify', 'On-premise']
export const AUTH_OPTIONS = ['Microsoft (Sogrape)', 'Google', 'Email e password', 'Sem autenticação', 'Outro']
export const LINK_SUGGESTIONS = ['Figma', 'Google AI Studio', 'Documentação', 'Manual', 'Deck', 'Jira', 'Teams']

export const STACK_SUGGESTIONS = {
  frontend: ['React', 'Vite', 'Next.js', 'TypeScript', 'Tailwind', 'Angular', 'Power Apps'],
  backend: ['Firebase Functions', 'Cloud Run', 'Node.js', 'Python', 'FastAPI', 'Apps Script', 'Power Automate', 'n8n'],
  llm: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Claude', 'GPT', 'Azure OpenAI', 'Vertex AI'],
  frameworks: ['Google ADK', 'LangChain', 'LangGraph', 'Genkit', 'MCP', 'Claude Agent SDK', 'OpenAI Agents SDK'],
}

export function emptyEnvironment(enabled = false): Environment {
  return {
    enabled,
    dbType: '',
    dbProject: '',
    dbId: '',
    hosting: '',
    appUrl: '',
    notes: '',
    variables: [],
  }
}

export function emptyApp(): AppInput {
  return {
    name: '',
    shortDescription: '',
    icon: '',
    description: '',
    area: '',
    priority: 'media',
    status: 'ideia',
    maturity: 'poc',
    owner: { name: '', email: '' },
    startDate: '',
    goLiveDate: '',
    activeUsers: null,
    stack: { frontend: [], backend: [], llm: [], frameworks: [], auth: '' },
    environments: { dev: emptyEnvironment(true), qa: emptyEnvironment(), prod: emptyEnvironment() },
    repo: { url: '', account: '', owner: '', branch: 'main' },
    links: [],
    governance: { personalData: 'por_avaliar', dataClassification: '', monthlyCost: null, risks: '', notes: '' },
  }
}

export const statusLabel = (k: StatusKey) => STATUSES.find((s) => s.key === k)?.label ?? k
export const maturityLabel = (k: MaturityKey) => MATURITIES.find((s) => s.key === k)?.label ?? k
export const priorityLabel = (k: PriorityKey) => PRIORITIES.find((s) => s.key === k)?.label ?? k
export const repoAccountLabel = (k: RepoAccount) => REPO_ACCOUNTS.find((s) => s.key === k)?.label ?? 'Não definida'
export const roleLabel = (k: Role) => ROLES.find((s) => s.key === k)?.label ?? k
export const secretTypeLabel = (k: SecretType) => SECRET_TYPES.find((s) => s.key === k)?.label ?? k

export const REQUEST_TYPES: { key: RequestType; label: string }[] = [
  { key: 'alteracao', label: 'Alteração' },
  { key: 'update', label: 'Update' },
  { key: 'modulo', label: 'Novo módulo' },
  { key: 'bug', label: 'Bug' },
]

export const REQUEST_STATUSES: { key: RequestStatus; label: string; open: boolean }[] = [
  { key: 'novo', label: 'Novo', open: true },
  { key: 'analise', label: 'Em análise', open: true },
  { key: 'curso', label: 'Em curso', open: true },
  { key: 'concluido', label: 'Concluído', open: false },
  { key: 'rejeitado', label: 'Rejeitado', open: false },
]

export const requestTypeLabel = (k: RequestType) => REQUEST_TYPES.find((t) => t.key === k)?.label ?? k
export const requestStatusLabel = (k: RequestStatus) => REQUEST_STATUSES.find((t) => t.key === k)?.label ?? k
export const isRequestOpen = (k: RequestStatus) => REQUEST_STATUSES.find((t) => t.key === k)?.open ?? true
