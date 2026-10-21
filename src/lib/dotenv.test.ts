import { describe, expect, it } from 'vitest'
import { looksSecret, parseDotenv, serializeDotenv } from './dotenv'

describe('dotenv', () => {
  it('lê comentários, export, aspas e multilinha', () => {
    const txt = [
      '# comentário',
      'export VITE_API_URL=https://api.exemplo.pt # inline',
      "GEMINI_API_KEY='abc123'",
      'DB_PASSWORD="p@ss \\"x\\""',
      'PRIVATE_KEY="-----BEGIN',
      'linha2',
      '-----END"',
      'INVALID LINE',
      'EMPTY=',
    ].join('\n')
    const r = parseDotenv(txt)
    expect(r.map((x) => x.key)).toEqual(['VITE_API_URL', 'GEMINI_API_KEY', 'DB_PASSWORD', 'PRIVATE_KEY', 'EMPTY'])
    expect(r[0].value).toBe('https://api.exemplo.pt')
    expect(r[0].looksSecret).toBe(false)
    expect(r[1].value).toBe('abc123')
    expect(r[1].looksSecret).toBe(true)
    expect(r[2].value).toBe('p@ss "x"')
    expect(r[3].value).toBe('-----BEGIN\nlinha2\n-----END')
    expect(r[4].value).toBe('')
  })

  it('faz ida e volta', () => {
    const entries = [
      { key: 'A', value: 'simples' },
      { key: 'B', value: 'com espaço e "aspas"' },
      { key: 'C', value: 'multi\nlinha' },
    ]
    const back = parseDotenv(serializeDotenv(entries, 'cabeçalho'))
    expect(back.map(({ key, value }) => ({ key, value }))).toEqual(entries)
  })

  it('heurística de secrets', () => {
    expect(looksSecret('VITE_FIREBASE_API_KEY')).toBe(false)
    expect(looksSecret('OPENAI_API_KEY')).toBe(true)
    expect(looksSecret('CLIENT_SECRET')).toBe(true)
    expect(looksSecret('PORT')).toBe(false)
  })
})
