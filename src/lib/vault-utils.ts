import { daysUntil } from './app-utils'
import { ROTATION_WARNING_DAYS } from './constants'
import type { AgenticApp, EnvKey, VaultItem } from './types'

const ENV_KEYS: EnvKey[] = ['dev', 'qa', 'prod']

export interface ItemUse {
  app: AgenticApp
  env: EnvKey
}

/** Itens do Credentials Vault ligados a uma app (opcionalmente só num ambiente). Ids de itens apagados são ignorados. */
export function linkedItems(app: AgenticApp, byId: Map<string, VaultItem>, env?: EnvKey): { env: EnvKey; item: VaultItem }[] {
  const out: { env: EnvKey; item: VaultItem }[] = []
  for (const k of env ? [env] : ENV_KEYS) {
    if (!app.environments[k].enabled && !env) continue
    for (const id of app.environments[k].vaultRefs) {
      const item = byId.get(id)
      if (item) out.push({ env: k, item })
    }
  }
  return out
}

/** Onde cada item é usado: id do item para a lista de (app, ambiente). */
export function usageIndex(apps: AgenticApp[]): Map<string, ItemUse[]> {
  const m = new Map<string, ItemUse[]>()
  for (const app of apps) {
    for (const env of ENV_KEYS) {
      for (const id of app.environments[env].vaultRefs) m.set(id, [...(m.get(id) ?? []), { app, env }])
    }
  }
  return m
}

export function needsRotation(item: { rotateBy: string }) {
  const d = daysUntil(item.rotateBy)
  return d !== null && d <= ROTATION_WARNING_DAYS
}

/** Nomes válidos para variáveis de ambiente. */
export const VAULT_NAME_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/
