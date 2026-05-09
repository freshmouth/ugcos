/**
 * UGC.OS System Health Check
 * Run: npx tsx --env-file apps/web/.env.local apps/web/scripts/system-health-check.ts
 */

import { createClient } from '@supabase/supabase-js'

const PASS = '✅'
const FAIL = '❌'
const WARN = '⚠️ '
const INFO = 'ℹ️ '

let score = 0
let maxScore = 0

type Result = { status: 'pass' | 'fail' | 'warn'; label: string; detail?: string }
const results: Result[] = []

function check(label: string, passed: boolean, detail?: string): void {
  maxScore++
  if (passed) {
    score++
    results.push({ status: 'pass', label, detail })
    console.log(`  ${PASS} ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    results.push({ status: 'fail', label, detail })
    console.log(`  ${FAIL} ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function warn(label: string, detail?: string): void {
  results.push({ status: 'warn', label, detail })
  console.log(`  ${WARN} ${label}${detail ? ` — ${detail}` : ''}`)
}

function section(name: string) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${name}`)
  console.log('═'.repeat(60))
}

// ─── 1. ENV VARS ──────────────────────────────────────────────────────────────

section('1. ENVIRONMENT VARIABLES')

const requiredEnvs = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FAL_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'SUBMAGIC_API_KEY',
  'METRICOOL_API_KEY',
  'METRICOOL_USER_ID',
  'OPENAI_API_KEY',
  'CRON_SECRET',
]

for (const key of requiredEnvs) {
  const val = process.env[key]
  check(key, !!val && val.trim() !== '', val ? `${val.slice(0, 8)}…` : 'MISSING')
}

// Warn about empty Stripe keys
const stripeKeys = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']
for (const key of stripeKeys) {
  const val = process.env[key]
  if (!val || val.trim() === '') {
    warn(key, 'Empty — OK for dev, required in production')
  } else {
    console.log(`  ${INFO} ${key} — set (${val.slice(0, 8)}…)`)
  }
}

// Check for trailing newline in OPENAI key
const openaiKey = process.env.OPENAI_API_KEY ?? ''
if (openaiKey.includes('\n') || openaiKey.includes('"')) {
  warn('OPENAI_API_KEY', 'Contains trailing newline or quote — may cause auth failures')
}

// ─── 2. SUPABASE / DATABASE ───────────────────────────────────────────────────

section('2. SUPABASE / DATABASE HEALTH')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const tables = ['profiles', 'projects', 'videos', 'subscriptions', 'insights']

for (const table of tables) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    if (error) {
      check(`Table: ${table}`, false, error.message)
    } else {
      check(`Table: ${table}`, true, `${count ?? 0} rows`)
    }
  } catch (e) {
    check(`Table: ${table}`, false, String(e))
  }
}

// Check deleted tables
for (const deletedTable of ['credits', 'credit_transactions']) {
  try {
    const { error } = await supabase.from(deletedTable).select('*', { count: 'exact', head: true })
    if (error?.code === '42P01') {
      console.log(`  ${INFO} Table '${deletedTable}' — correctly deleted`)
    } else {
      warn(`Table '${deletedTable}'`, 'Still exists — should be deleted per CLAUDE.md')
    }
  } catch {
    console.log(`  ${INFO} Table '${deletedTable}' — not accessible (expected)`)
  }
}

// Database health query
try {
  const [
    { count: profiles },
    { count: projects },
    { count: videos },
    { count: subscriptions },
    { count: insights },
    { count: stuckVideos },
    { count: unlinkedBrands },
    { count: unpostedDoneVideos },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('videos').select('*', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
    supabase.from('insights').select('*', { count: 'exact', head: true }),
    supabase.from('videos').select('*', { count: 'exact', head: true })
      .not('status', 'in', '("done","failed")')
      .lt('updated_at', new Date(Date.now() - 2 * 3600000).toISOString()),
    supabase.from('projects').select('*', { count: 'exact', head: true })
      .is('metricool_brand_id', null),
    supabase.from('videos').select('*', { count: 'exact', head: true })
      .eq('status', 'done')
      .is('metricool_post_id', null),
  ])

  console.log(`\n  DB Snapshot:`)
  console.log(`    profiles=${profiles}  projects=${projects}  videos=${videos}`)
  console.log(`    subscriptions=${subscriptions}  insights=${insights}`)
  console.log(`    stuck_videos (>2h)=${stuckVideos}  unlinked_brands=${unlinkedBrands}  unposted_done=${unpostedDoneVideos}`)

  if ((stuckVideos ?? 0) > 0) {
    warn('Stuck videos', `${stuckVideos} video(s) stuck >2h in non-terminal status`)
  }
  if ((unlinkedBrands ?? 0) > 0) {
    warn('Unlinked brands', `${unlinkedBrands} project(s) missing metricool_brand_id`)
  }
  if ((unpostedDoneVideos ?? 0) > 0) {
    warn('Unposted done videos', `${unpostedDoneVideos} video(s) with status=done but no metricool_post_id`)
  }

  // Check insights table has video_breakdowns column
  const { data: insightSample, error: insightErr } = await supabase
    .from('insights')
    .select('video_breakdowns')
    .limit(1)
    .maybeSingle()
  if (insightErr?.message?.includes('video_breakdowns')) {
    check('insights.video_breakdowns column', false, 'Column missing — run migration 20260430_insights_video_breakdowns.sql')
  } else {
    check('insights.video_breakdowns column', true, 'Column exists')
  }
} catch (e) {
  warn('DB health query', String(e))
}

// ─── 3. METRICOOL API ─────────────────────────────────────────────────────────

section('3. METRICOOL API')

try {
  const mcKey = process.env.METRICOOL_API_KEY!
  const mcUserId = process.env.METRICOOL_USER_ID ?? '4210220'

  const res = await fetch(`https://app.metricool.com/api/admin/simpleProfiles?userId=${mcUserId}`, {
    headers: { 'X-Mc-Auth': mcKey, Accept: 'application/json' },
  })
  const text = await res.text()
  check('GET /api/admin/simpleProfiles', res.ok, `HTTP ${res.status}`)

  if (res.ok) {
    try {
      const data = JSON.parse(text)
      const brands = Array.isArray(data) ? data : (data?.data ?? data?.brands ?? [])
      console.log(`  ${INFO} Found ${brands.length} brand(s): ${brands.map((b: { blogName?: string; name?: string }) => b.blogName ?? b.name).join(', ')}`)
    } catch {
      warn('Metricool brands', 'Could not parse response as JSON')
    }
  }
} catch (e) {
  check('Metricool connectivity', false, String(e))
}

// ─── 4. FAL AI ────────────────────────────────────────────────────────────────

section('4. FAL AI')

try {
  const falKey = process.env.FAL_KEY!
  const [keyId] = falKey.split(':')
  // Test by hitting the FAL queue endpoint with a minimal check
  const res = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
    method: 'HEAD',
    headers: { Authorization: `Key ${falKey}` },
  })
  // HEAD may return 405 but that proves auth is valid (401 = bad key)
  check('FAL AI connectivity', res.status !== 401, `HTTP ${res.status} (key: ${keyId?.slice(0, 8)}…)`)
} catch (e) {
  check('FAL AI connectivity', false, String(e))
}

// ─── 5. CLOUDINARY ────────────────────────────────────────────────────────────

section('5. CLOUDINARY')

try {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!
  const apiKey = process.env.CLOUDINARY_API_KEY!
  const apiSecret = process.env.CLOUDINARY_API_SECRET!

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  const authRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/folders`,
    { headers: { Authorization: `Basic ${auth}` } }
  )
  check('Cloudinary API auth', authRes.ok, `HTTP ${authRes.status}`)

  if (authRes.ok) {
    // Use Search API (more reliable than prefix list for nested folders)
    const searchRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`,
      {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: 'folder="catalog/sal-celtica/ugc-refs"', max_results: 1 }),
      }
    )
    if (searchRes.ok) {
      const data = await searchRes.json() as { total_count?: number }
      const count = data.total_count ?? 0
      check('catalog/sal-celtica/ugc-refs (Search API)', count > 0, `${count} images found`)
      if (count < 500) warn('UGC reference images', `Only ${count} found, expected ~506`)
    } else {
      warn('Cloudinary Search API', `HTTP ${searchRes.status}`)
    }
  }
} catch (e) {
  check('Cloudinary connectivity', false, String(e))
}

// ─── 6. OPENAI ────────────────────────────────────────────────────────────────

section('6. OPENAI')

try {
  const key = (process.env.OPENAI_API_KEY ?? '').replace(/[\n"]/g, '').trim()
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  })
  check('OpenAI API', res.ok, `HTTP ${res.status}`)
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } }
    console.log(`  ${INFO} Error: ${err.error?.message}`)
  }
} catch (e) {
  check('OpenAI connectivity', false, String(e))
}

// ─── 7. PIPELINE STAGES ───────────────────────────────────────────────────────

section('7. PIPELINE STAGES')

import { statSync } from 'fs'
import { resolve } from 'path'

const stageFiles = [
  'lib/pipeline/stages/01-comprehension.ts',
  'lib/pipeline/stages/02-creative-brain.ts',
  'lib/pipeline/stages/03-image-generation.ts',
  'lib/pipeline/stages/04-video-generation.ts',
  'lib/pipeline/stages/05-assembly.ts',
  'lib/pipeline/stages/06-captions.ts',
  'lib/pipeline/stages/07-publish.ts',
  'lib/pipeline/utils/model-router.ts',
  'lib/pipeline/run.ts',
]

const webDir = resolve(process.cwd(), 'apps/web')

for (const f of stageFiles) {
  try {
    statSync(resolve(webDir, f))
    check(f, true)
  } catch {
    check(f, false, 'File not found')
  }
}

// Check model router reads env var
const preferredModel = process.env.PREFERRED_VIDEO_MODEL ?? '(not set)'
console.log(`  ${INFO} PREFERRED_VIDEO_MODEL = ${preferredModel}`)
check(
  'PREFERRED_VIDEO_MODEL valid',
  ['sora', 'seedance', 'seedance-standard', undefined, ''].includes(process.env.PREFERRED_VIDEO_MODEL),
  preferredModel
)

// ─── 8. KNOWN CODE ISSUES ─────────────────────────────────────────────────────

section('8. KNOWN CODE ISSUES (static analysis)')

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

function findInFiles(dir: string, pattern: RegExp, ext = '.ts'): string[] {
  const hits: string[] = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true } as { withFileTypes: true; recursive: boolean })
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(ext)) {
        const fullPath = join((e as { parentPath?: string; path?: string } & { name: string }).parentPath ?? (e as unknown as { path: string }).path ?? dir, e.name)
        try {
          const content = readFileSync(fullPath, 'utf8')
          if (pattern.test(content)) hits.push(fullPath.replace(webDir, ''))
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
  return hits
}

// Check hardcoded brand paths in pipeline (should come from project config)
const hardcodedBrandFiles = findInFiles(resolve(webDir, 'lib/pipeline'), /sal-celtica|Sal Céltica|SAL_CELTICA/i)
if (hardcodedBrandFiles.length > 0) {
  warn('Hardcoded brand in pipeline', `${hardcodedBrandFiles.length} file(s): ${hardcodedBrandFiles.join(', ')}`)
} else {
  check('Pipeline brand-agnostic', true)
}

// Check cron still references credits table
const cronContent = readFileSync(resolve(webDir, 'app/api/cron/route.ts'), 'utf8')
if (cronContent.includes('credits!inner') || cronContent.includes("from('credits')") || cronContent.includes('credit_transactions')) {
  warn('Cron uses credits table', 'Cron references deleted credits/credit_transactions — will fail if tables removed')
} else {
  check('Cron uses subscriptions (not credits)', true)
}

// Check .single() vs .maybeSingle() in API routes
const singleFiles = findInFiles(resolve(webDir, 'app/api'), /\.single\(\)/)
warn('.single() in API routes', `${singleFiles.length} file(s) use .single() which throws on missing rows — consider .maybeSingle()`)

// Check img tags without onError in components
const imgWithoutFallback = findInFiles(resolve(webDir, 'components'), /<img/, '.tsx')
console.log(`  ${INFO} Components with <img>: ${imgWithoutFallback.length} — verify each has onError fallback`)

// Check fetch() without signal/timeout in pipeline
const fetchWithoutTimeout = findInFiles(resolve(webDir, 'lib/pipeline'), /fetch\(/)
warn('fetch() without timeout in pipeline', `${fetchWithoutTimeout.length} file(s) — no AbortController timeout, risk of hanging`)

// Check brand context in sidebar (just fixed)
const sidebarContent = readFileSync(resolve(webDir, 'components/app/sidebar.tsx'), 'utf8')
check('Sidebar carries brand param in nav links', sidebarContent.includes('activeBrand') && sidebarContent.includes('navHref'))

// Check brand-switcher uses pathname (just fixed)
const switcherContent = readFileSync(resolve(webDir, 'components/app/brand-switcher.tsx'), 'utf8')
check('BrandSwitcher preserves current path', switcherContent.includes('usePathname'))

// Check videos page only shows posted videos (just fixed)
const videosContent = readFileSync(resolve(webDir, 'app/(app)/videos/page.tsx'), 'utf8')
check('My Videos: only posted (status=done + metricool_post_id)', videosContent.includes("metricool_post_id', 'is', null"))

// Check hook-card shows top 3
const hookContent = readFileSync(resolve(webDir, 'components/app/hook-card.tsx'), 'utf8')
check('HookCard: shows top 3 hooks', hookContent.includes('slice(0, 3)'))

// Check owner bypass in analyze route
const analyzeContent = readFileSync(resolve(webDir, 'app/api/insights/analyze/route.ts'), 'utf8')
check('Insights: owner bypass for rate limit', analyzeContent.includes('OWNER_EMAIL') && analyzeContent.includes('isOwner'))

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

section('SUMMARY')

const healthScore = Math.round((score / maxScore) * 10 * 10) / 10
const fails = results.filter(r => r.status === 'fail')
const warns = results.filter(r => r.status === 'warn')

console.log(`\n  Health Score: ${healthScore}/10  (${score}/${maxScore} checks passed)`)
console.log(`  Failures: ${fails.length}  Warnings: ${warns.length}`)

if (fails.length > 0) {
  console.log('\n  CRITICAL/HIGH FAILURES:')
  fails.forEach(f => console.log(`    ${FAIL} ${f.label}${f.detail ? `: ${f.detail}` : ''}`))
}

if (warns.length > 0) {
  console.log('\n  WARNINGS:')
  warns.forEach(w => console.log(`    ${WARN} ${w.label}${w.detail ? `: ${w.detail}` : ''}`))
}

console.log('')
