import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')
const raw = readFileSync(envPath, 'utf-8')

const lines = raw.split('\n')

for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue

  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue

  const key = trimmed.slice(0, eqIdx).trim()
  const value = trimmed.slice(eqIdx + 1).trim()

  if (!key) continue

  const result = spawnSync('vercel', ['env', 'add', key, 'production'], {
    input: value + '\n',
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, NODE_OPTIONS: '--use-system-ca' },
  })

  if (result.error) {
    console.error(`✗  ${key}  →  spawn error: ${result.error.message}`)
    continue
  }

  const stdout = (result.stdout ?? '').trim()
  const stderr = (result.stderr ?? '').trim()
  const combined = stderr || stdout

  if (result.status === 0) {
    console.log(`✓  ${key}`)
  } else if (combined.toLowerCase().includes('already exists') || combined.toLowerCase().includes('already been added')) {
    console.log(`~  ${key}  (already exists — skipped)`)
  } else {
    console.error(`✗  ${key}  →  ${combined || `exit ${result.status}`}`)
  }
}
