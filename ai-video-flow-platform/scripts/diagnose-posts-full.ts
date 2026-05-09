// Check stats/posts with wider date range and check all reel fields
const KEY = process.env.METRICOOL_API_KEY!
const H = { 'X-Mc-Auth': KEY, Accept: 'application/json' }
const USER_ID = '4210220'

if (!KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }

async function main() {
  // Try stats/posts with wider ranges
  for (const [label, url] of [
    ['posts Sal 2025-2026', `https://app.metricool.com/api/stats/posts?blogId=5418754&userId=${USER_ID}&start=20250101&end=20260429`],
    ['posts Canela 2025-2026', `https://app.metricool.com/api/stats/posts?blogId=6150383&userId=${USER_ID}&start=20250101&end=20260429`],
  ]) {
    const r = await fetch(url as string, { headers: H })
    const d = await r.json() as unknown[]
    console.log(`\n[${label}] status=${r.status} count=${Array.isArray(d) ? d.length : 'not-array'}`)
    if (Array.isArray(d) && d.length > 0) {
      const f = d[0] as Record<string, unknown>
      console.log('  keys:', Object.keys(f).join(', '))
      console.log('  first:', JSON.stringify(f, null, 2).slice(0, 800))
    }
  }

  // Show FULL first reel to see all metric fields
  const r2 = await fetch(
    `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=5418754&userId=${USER_ID}&from=${encodeURIComponent('2026-01-01T00:00:00')}&to=${encodeURIComponent('2026-04-29T23:59:59')}`,
    { headers: H }
  )
  const d2 = await r2.json() as { data?: Record<string, unknown>[] }
  const reels = Array.isArray(d2) ? d2 : (d2.data ?? []) as Record<string, unknown>[]
  if (reels.length > 0) {
    console.log('\n[FULL first reel — all fields]:')
    console.log(JSON.stringify(reels[0], null, 2))
    console.log('\n[Second reel]:')
    console.log(JSON.stringify(reels[1], null, 2))
  }

  // Check if videos table has metricool_post_id column via supabase REST
  // (can't do this without supabase client here, skip)
}

main().catch(console.error)
