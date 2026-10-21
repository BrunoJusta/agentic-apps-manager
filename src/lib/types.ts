import type { Timestamp } from 'firebase/firestore'

export type Role = 'admin' | 'editor' | 'viewer'

export type StatusKey =
  | 'ideia'
  | 'discovery'
  | 'desenvolvimento'
  | 'qa'
  | 'producao'
  | 'manutencao'
  | 'descontinuada'

export type MaturityKey = 'poc' | 'piloto' | 'mvp' | 'estavel' | 'escala'
export type PriorityKey = 'baixa' | 'media' | 'alta' | 'critica'
export type EnvKey = 'dev' | 'qa' | 'prod'
export type RepoAccount = 'pessoal' | 'sogrape' | ''
export type PersonalData = 'sim' | 'nao' | 'por_avaliar'

export interface Person {
  name: string
  email: string
}

export interface Variable {
  key: string
  value: string
  note?: string
}

export interface Environment {
  enabled: boolean
  dbType: string
  dbProject: string
  dbId: string
  dbUrl: string
  hosting: string
  hostingUrl: string
  appUrl: string
  notes: string
  variables: Variable[]
}

export interface AppLink {
  label: string
  url: string
}

export interface AgenticApp {
  id: string
  name: string
  shortDescription: string
  description: string
  area: string
  priority: PriorityKey
  status: StatusKey
  maturity: MaturityKey
  businessOwner: Person
  aiLead: Person
  developers: Person[]
  supportL1: Person[]
  supportL2: Person[]
  itContact: Person
  startDate: string
  goLiveDate: string
  activeUsers: number | null
  stack: {
    frontend: string[]
    backend: string[]
    llm: string[]
    frameworks: string[]
    auth: string
  }
  environments: Record<EnvKey, Environment>
  repo: {
    url: string
    account: RepoAccount
    owner: string
    branch: string
  }
  links: AppLink[]
  governance: {
    personalData: PersonalData
    dataClassification: string
    monthlyCost: number | null
    risks: string
    notes: string
  }
  createdAt?: Timestamp | null
  createdBy?: string
  updatedAt?: Timestamp | null
  updatedBy?: string
}

export type AppInput = Omit<AgenticApp, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>

export interface UserProfile {
  email: string
  displayName: string
  role: Role
  active: boolean
  createdAt?: Timestamp | null
  createdBy?: string
  lastLoginAt?: Timestamp | null
}

export interface EncryptedBlob {
  iv: string
  ct: string
}

export interface UserKeys {
  email: string
  publicKey: string
  fingerprint: string
  encPrivateKey: EncryptedBlob & { salt: string; iterations: number }
  createdAt?: Timestamp | null
}

export interface VaultMeta {
  version: number
  check: EncryptedBlob
  createdAt?: Timestamp | null
  createdBy?: string
  rotatedAt?: Timestamp | null
  rotatedBy?: string
}

export interface VaultGrant {
  email: string
  wrappedKey: string
  version: number
  grantedBy: string
  grantedAt?: Timestamp | null
}

export type SecretType = 'api_key' | 'password' | 'connection_string' | 'service_account' | 'token' | 'other'

export interface SecretDoc {
  id: string
  appId: string
  env: EnvKey
  name: string
  type: SecretType
  note: string
  rotateBy: string
  iv: string
  ct: string
  version: number
  createdAt?: Timestamp | null
  createdBy?: string
  updatedAt?: Timestamp | null
  updatedBy?: string
}

export interface HistoryEntry {
  id: string
  at?: Timestamp | null
  by: string
  byName: string
  action: string
  summary: string
}

export type AuditAction =
  | 'login'
  | 'reveal'
  | 'copy'
  | 'export_env'
  | 'import_env'
  | 'secret_create'
  | 'secret_update'
  | 'secret_delete'
  | 'vault_init'
  | 'vault_grant'
  | 'vault_revoke'
  | 'vault_rotate'
  | 'keys_create'
  | 'keys_reset'
  | 'user_create'
  | 'user_update'
  | 'app_delete'

export interface AuditEntry {
  id: string
  at?: Timestamp | null
  by: string
  action: AuditAction
  appId?: string
  appName?: string
  env?: string
  target?: string
  detail?: string
}
