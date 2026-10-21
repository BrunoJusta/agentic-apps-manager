export interface ParsedEnvLine {
  key: string
  value: string
  /** Sugestão automática: true se o nome parece um secret. */
  looksSecret: boolean
}

const SECRET_HINT = /(SECRET|TOKEN|PASSWORD|PASSWD|PWD|PRIVATE|API_?KEY|ACCESS_?KEY|CREDENTIAL|CONNECTION_?STRING|DSN|CLIENT_?SECRET|SERVICE_?ACCOUNT|AUTH)/i
const PUBLIC_HINT = /^(VITE_|NEXT_PUBLIC_|PUBLIC_|REACT_APP_)/i

export function looksSecret(key: string): boolean {
  if (PUBLIC_HINT.test(key) && !/SECRET|PASSWORD|PRIVATE/i.test(key)) return false
  return SECRET_HINT.test(key)
}

/** Parser de .env tolerante: comentários, export, aspas simples/duplas, \n em aspas duplas e valores multilinha entre aspas. */
export function parseDotenv(text: string): ParsedEnvLine[] {
  const out: ParsedEnvLine[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('export ')) line = line.slice(7).trim()
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)) continue
    let raw = line.slice(eq + 1).trim()
    let value: string
    const q = raw[0]
    if (q === '"' || q === "'" || q === '`') {
      // valor entre aspas, possivelmente multilinha
      let body = raw.slice(1)
      while (!endsWithQuote(body, q) && i + 1 < lines.length) {
        i++
        body += '\n' + lines[i]
      }
      body = endsWithQuote(body, q) ? body.slice(0, body.lastIndexOf(q)) : body
      value = q === '"' ? body.replace(/\\n/g, '\n').replace(/\\"/g, '"') : body
    } else {
      const hash = raw.search(/\s#/)
      if (hash >= 0) raw = raw.slice(0, hash)
      value = raw.trim()
    }
    out.push({ key, value, looksSecret: looksSecret(key) })
  }
  // a última definição de uma chave ganha
  const seen = new Map<string, ParsedEnvLine>()
  for (const l of out) seen.set(l.key, l)
  return [...seen.values()]
}

function endsWithQuote(s: string, q: string) {
  const t = s.trimEnd()
  return t.endsWith(q) && !t.endsWith('\\' + q)
}

export function serializeDotenv(entries: { key: string; value: string; comment?: string }[], header?: string): string {
  const lines: string[] = []
  if (header) lines.push(...header.split('\n').map((l) => `# ${l}`), '')
  for (const e of entries) {
    if (e.comment) lines.push(`# ${e.comment}`)
    lines.push(`${e.key}=${quote(e.value)}`)
  }
  return lines.join('\n') + '\n'
}

function quote(v: string) {
  if (v === '') return ''
  if (/^[A-Za-z0-9_./:@+-]+$/.test(v)) return v
  return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"'
}
