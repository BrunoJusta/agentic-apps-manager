import type { Timestamp } from 'firebase/firestore'

export type Role = 'admin' | 'editor' | 'viewer'

export type StatusKey =
  | 'ideia'
  | 'discovery'
  | 'desenvolvimento'
  | 'qa'
  | 'producao'
  | 'descontinuada'

export type MaturityKey = 'poc' | 'piloto' | 'mvp' | 'estavel' | 'escala'
export type PriorityKey = 'baixa' | 'media' | 'alta' | 'critica'
export type EnvKey = 'dev' | 'qa' | 'prod'
export type RepoAccount = 'pessoal' | 'sogrape' | 'ai_studio' | ''
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
  hosting: string
  appUrl: string
  notes: string
  /** Itens do Credentials Vault ligados a este ambiente (ids de vaultItems). A app só guarda a referência. */
  vaultRefs: string[]
  /** Antigo: variáveis em texto simples. Só existe até serem migradas para o Credentials Vault. */
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
  /** Ícone quadrado (1:1) como data URL, até 256x256. */
  icon: string
  description: string
  area: string
  priority: PriorityKey
  status: StatusKey
  maturity: MaturityKey
  /** Responsável pela app. */
  owner: Person
  startDate: string
  goLiveDate: string
  /** Antigo: já não se edita nem se mostra. */
  activeUsers?: number | null
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
    /** Antigo: já não se edita nem se mostra. */
    monthlyCost?: number | null
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

export type VaultItemKind = 'variable' | 'secret'

/**
 * Item do Credentials Vault (variável ou secret). Vive em vaultItems/{id}, com o valor sempre cifrado.
 * As apps só guardam o id em environments.{env}.vaultRefs; na ficha vê-se o nome, nunca o valor.
 */
export interface VaultItem {
  id: string
  name: string
  kind: VaultItemKind
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

/** Antigo: secret guardado dentro da app (apps/{appId}/secrets). Só existe até ser migrado. */
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

export type RequestType = 'alteracao' | 'update' | 'modulo' | 'bug'
export type RequestStatus = 'novo' | 'analise' | 'curso' | 'concluido' | 'rejeitado'

/** Pedido sobre uma app (sobretudo em produção): alteração, update, novo módulo ou bug. */
export interface AppRequest {
  id: string
  appId: string
  type: RequestType
  title: string
  description: string
  priority: PriorityKey
  status: RequestStatus
  requestedBy: Person
  dueDate: string
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
  | 'vault_link'
  | 'vault_unlink'
  | 'vault_migrate'
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
