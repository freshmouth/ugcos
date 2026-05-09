// Quick check: impressionsTotal vs views for both brands
const KEY = process.env.METRICOOL_API_KEY!
const H = { 'X-Mc-Auth': KEY, Accept: 'application/json' }
const USER_ID = '4210220'

type Reel = {
  reelId: string; content?: string; views?: number; impressionsTotal?: number; reach?: number
  engagement?: number; publishedAt?: { dateTime?: string; timezone?: string } | string
  imageUrl?: string
}

async function checkBrand(label: string, blogId: string) {
  const url = `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=${blogId}&userId=${USER_ID}&from=${encodeURIComponent('2026-01-01T00:00:00')}&to=${encodeURIComponent('2026-04-29T23:59:59')}`
  const res = await fetch(url, { headers: H })
  const raw = await res.json() as { data?: Reel[] } | Reel[]
  const reels: Reel[] = Array.isArray(raw) ? raw : ((raw as { data?: Reel[] }).data ?? [])

  let totalViews = 0, totalIT = 0, totalReach = 0
  for (const r of reels) {
    totalViews += r.views ?? 0
    totalIT += r.impressionsTotal ?? 0
    totalReach += r.reach ?? 0
  }
  console.log(`\n[${label}] reels=${reels.length}`)
  console.log(`  SUM views: ${totalViews.toLocaleString()}`)
  console.log(`  SUM impressionsTotal: ${totalIT.toLocaleString()}`)
  console.log(`  SUM reach: ${totalReach.toLocaleString()}`)

  if (reels.length > 0) {
    const f = reels[0]!
    console.log(`  publishedAt type: ${typeof f.publishedAt}`)
    console.log(`  publishedAt value: ${JSON.stringify(f.publishedAt)}`)
    console.log(`  imageUrl: ${f.imageUrl ? f.imageUrl.slice(0, 80) + '...' : 'null'}`)
    console.log(`  content[0:60]: ${(f.content ?? '').slice(0, 60)}`)
  }

  // Show last 5 for schedule widget
  console.log(`\n  Last 5 reels for schedule widget:`)
  for (const r of reels.slice(0, 5)) {
    const pa = r.publishedAt
    const dt = typeof pa === 'string' ? pa : (pa as { dateTime?: string })?.dateTime ?? ''
    console.log(`    ${dt} | ${(r.content ?? '').slice(0, 35)}`)
  }
}

async function main() {
  if (!KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }
  await checkBrand('Sal Céltica', '5418754')
  await checkBrand('Canela', '6150383')
}

main().catch(console.error)
