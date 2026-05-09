// Run: cd apps/web && npx tsx --env-file .env.local scripts/test-metricool-auth.ts
const KEY     = process.env.METRICOOL_API_KEY!
const BLOG_ID = process.env.METRICOOL_BLOG_ID ?? '6150383'
const USER_ID = process.env.METRICOOL_USER_ID ?? '4210220'

if (!KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }

const SHARED_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; UGC-Platform/1.0)',
}

async function probe(label: string, url: string, extraHeaders: Record<string, string> = {}, method = 'GET', body?: string) {
  try {
    const res = await fetch(url, {
      method,
      headers: { ...SHARED_HEADERS, ...extraHeaders },
      body,
    })
    const text = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { /* not JSON */ }

    console.log(`\n[${label}]`)
    console.log(`  ${method} ${url}`)
    if (Object.keys(extraHeaders).length) console.log(`  Extra headers: ${JSON.stringify(extraHeaders)}`)
    console.log(`  → ${res.status} ${res.statusText}`)
    if (parsed) {
      console.log(`  Body (JSON): ${JSON.stringify(parsed).slice(0, 400)}`)
    } else {
      const snippet = text.replace(/\s+/g, ' ').slice(0, 200)
      console.log(`  Body (text): ${snippet}`)
    }
    return res.status
  } catch (e) {
    console.log(`\n[${label}] THREW: ${e instanceof Error ? e.message : e}`)
    return 0
  }
}

async function main() {
  console.log('=== Metricool Auth Deep Probe ===')
  console.log(`KEY length: ${KEY.length}  last-8: ...${KEY.slice(-8)}`)
  console.log(`BLOG_ID: ${BLOG_ID}  USER_ID: ${USER_ID}\n`)

  const results: Array<{ label: string; status: number }> = []
  const R = (label: string, status: number) => results.push({ label, status })

  // ── Group 0: X-Mc-Auth — official auth format ─────────────────────────────
  R('0A simpleProfiles X-Mc-Auth', await probe('0A simpleProfiles X-Mc-Auth',
    `https://app.metricool.com/api/admin/simpleProfiles?blogId=${BLOG_ID}&userId=${USER_ID}`,
    { 'X-Mc-Auth': KEY }))

  const fmtDT = (d: Date) => d.toISOString().replace('Z', '').split('.')[0]!
  R('0B scheduler/posts X-Mc-Auth (GET)', await probe('0B scheduler/posts X-Mc-Auth',
    `https://app.metricool.com/api/v2/scheduler/posts?blogId=${BLOG_ID}&userId=${USER_ID}&start=${fmtDT(new Date())}&end=${fmtDT(new Date(Date.now() + 30 * 86400000))}`,
    { 'X-Mc-Auth': KEY }))

  // ── Group A: v2 /brands — all auth variants ────────────────────────────────
  R('A1 v2/brands Bearer', await probe('A1 v2/brands Bearer',
    `https://app.metricool.com/api/v2/brands`,
    { Authorization: `Bearer ${KEY}` }))

  R('A2 v2/brands Bearer+userId header', await probe('A2 v2/brands Bearer+userId hdr',
    `https://app.metricool.com/api/v2/brands`,
    { Authorization: `Bearer ${KEY}`, 'X-User-Id': USER_ID }))

  R('A3 v2/brands token QParam', await probe('A3 v2/brands token QParam',
    `https://app.metricool.com/api/v2/brands?token=${KEY}&userId=${USER_ID}`))

  R('A4 v2/brands api_key QParam', await probe('A4 v2/brands api_key QParam',
    `https://app.metricool.com/api/v2/brands?api_key=${KEY}&userId=${USER_ID}`))

  R('A5 v2/brands accessToken QParam', await probe('A5 v2/brands accessToken QParam',
    `https://app.metricool.com/api/v2/brands?accessToken=${KEY}&userId=${USER_ID}`))

  // ── Group B: v1 API (older endpoint) ──────────────────────────────────────
  R('B1 v1/brands Bearer', await probe('B1 v1/brands Bearer',
    `https://app.metricool.com/api/v1/brands`,
    { Authorization: `Bearer ${KEY}` }))

  R('B2 v1/brands token QParam', await probe('B2 v1/brands token QParam',
    `https://app.metricool.com/api/v1/brands?token=${KEY}&userId=${USER_ID}`))

  R('B3 v1/app Bearer', await probe('B3 v1/app Bearer',
    `https://app.metricool.com/api/v1/app`,
    { Authorization: `Bearer ${KEY}` }))

  // ── Group C: /me / /user endpoints ────────────────────────────────────────
  R('C1 v2/me Bearer', await probe('C1 v2/me Bearer',
    `https://app.metricool.com/api/v2/me`,
    { Authorization: `Bearer ${KEY}` }))

  R('C2 v2/user Bearer', await probe('C2 v2/user Bearer',
    `https://app.metricool.com/api/v2/user`,
    { Authorization: `Bearer ${KEY}` }))

  R('C3 v2/me token QParam', await probe('C3 v2/me token QParam',
    `https://app.metricool.com/api/v2/me?token=${KEY}&userId=${USER_ID}`))

  // ── Group D: key as username in Basic auth ─────────────────────────────────
  const basicKeyUser = Buffer.from(`${KEY}:`).toString('base64')
  R('D1 Basic key:empty /brands', await probe('D1 Basic key:empty /brands',
    `https://app.metricool.com/api/v2/brands`,
    { Authorization: `Basic ${basicKeyUser}` }))

  // ── Group E: POST to auth/token first ────────────────────────────────────
  R('E1 POST v2/auth/token', await probe('E1 POST v2/auth/token',
    `https://app.metricool.com/api/v2/auth/token`,
    {}, 'POST', JSON.stringify({ token: KEY, userId: USER_ID })))

  R('E2 POST v2/token', await probe('E2 POST v2/token',
    `https://app.metricool.com/api/v2/token`,
    {}, 'POST', JSON.stringify({ apiKey: KEY })))

  // ── Group F: base URL variations ──────────────────────────────────────────
  R('F1 no-app subdomain /brands', await probe('F1 no-app subdomain /brands',
    `https://metricool.com/api/v2/brands`,
    { Authorization: `Bearer ${KEY}` }))

  R('F2 v2/brands with blogId path', await probe('F2 v2/brands/:blogId',
    `https://app.metricool.com/api/v2/brands/${BLOG_ID}`,
    { Authorization: `Bearer ${KEY}` }))

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n\n══════════════════════════════════════')
  console.log('SUMMARY')
  console.log('══════════════════════════════════════')
  for (const r of results) {
    const mark = r.status >= 200 && r.status < 300
      ? '✅'
      : r.status === 401 ? '❌401'
      : r.status === 403 ? '❌403'
      : r.status === 404 ? '⚠️ 404'
      : `⚠️  ${r.status}`
    console.log(`  ${mark}  ${r.label}`)
  }

  const winners = results.filter(r => r.status >= 200 && r.status < 300)
  if (winners.length) {
    console.log('\n✅ WORKING:', winners.map(w => w.label).join(', '))
  } else {
    console.log('\n❌ ALL FAILED — key is likely invalid or account has no API access.')
    console.log('   Steps to fix:')
    console.log('   1. Log into app.metricool.com')
    console.log('   2. Go to Settings (gear icon) → Integrations → API')
    console.log('   3. Generate a NEW API token and update METRICOOL_API_KEY in .env.local')
    console.log(`   Current key length: ${KEY.length} chars — valid tokens are usually 64+ chars`)
  }
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Unhandled error:', err)
  process.exit(1)
})
