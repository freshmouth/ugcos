// Diagnosis for fix-everything.txt — run: npx tsx --env-file=apps/web/.env.local scripts/diagnose-fix3.ts
const KEY = process.env.METRICOOL_API_KEY!
const H = { 'X-Mc-Auth': KEY, Accept: 'application/json' }
const USER_ID = '4210220'

if (!KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }

async function get(label: string, url: string) {
  const res = await fetch(url, { headers: H })
  const text = await res.text()
  console.log(`\n[${label}] status=${res.status}`)
  try {
    const data = JSON.parse(text)
    if (Array.isArray(data)) {
      console.log(`  count: ${data.length}`)
      if (data.length > 0) {
        const f = data[0] as Record<string, unknown>
        console.log(`  keys: ${Object.keys(f).join(', ')}`)
        console.log(`  first: ${JSON.stringify(f, null, 2).slice(0, 600)}`)
        console.log(`  Has picture? ${!!f.picture}`)
        console.log(`  Has thumbnail? ${!!f.thumbnail}`)
        console.log(`  Has videoUrl? ${!!f.videoUrl}`)
        console.log(`  Has link? ${!!f.link}`)
        // sum views/impressions
        const totV = (data as Record<string, unknown>[]).reduce((s, r) => s + ((r.views as number) ?? 0), 0)
        const totI = (data as Record<string, unknown>[]).reduce((s, r) => s + ((r.impressions as number) ?? 0), 0)
        const totR = (data as Record<string, unknown>[]).reduce((s, r) => s + ((r.reach as number) ?? 0), 0)
        if (totV) console.log(`  SUM views: ${totV.toLocaleString()}`)
        if (totI) console.log(`  SUM impressions: ${totI.toLocaleString()}`)
        if (totR) console.log(`  SUM reach: ${totR.toLocaleString()}`)
      }
    } else if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      if (Array.isArray(d.data)) {
        console.log(`  data.length: ${d.data.length}`)
        if (d.data.length > 0) {
          const f = d.data[0] as Record<string, unknown>
          console.log(`  keys: ${Object.keys(f).join(', ')}`)
          console.log(`  first: ${JSON.stringify(f, null, 2).slice(0, 600)}`)
          const totV = (d.data as Record<string, unknown>[]).reduce((s, r) => s + ((r.views as number) ?? 0), 0)
          const totI = (d.data as Record<string, unknown>[]).reduce((s, r) => s + ((r.impressions as number) ?? 0), 0)
          if (totV) console.log(`  SUM views: ${totV.toLocaleString()}`)
          if (totI) console.log(`  SUM impressions: ${totI.toLocaleString()}`)
        }
      } else {
        console.log(`  response: ${JSON.stringify(data).slice(0, 400)}`)
      }
    } else {
      console.log(`  raw: ${text.slice(0, 300)}`)
    }
  } catch {
    console.log(`  raw: ${text.slice(0, 300)}`)
  }
}

async function main() {
  // 1. stats/posts for Canela (blogId=6150383) — diagnosis snippet from fix-everything.txt
  await get('stats/posts Canela [20260101-20260429]',
    `https://app.metricool.com/api/stats/posts?blogId=6150383&userId=${USER_ID}&start=20260101&end=20260429`)

  // 2. stats/posts for Sal Céltica (blogId=5418754)
  await get('stats/posts SalCeltica [20260101-20260429]',
    `https://app.metricool.com/api/stats/posts?blogId=5418754&userId=${USER_ID}&start=20260101&end=20260429`)

  // 3. FB timeline impressions — both brands, today's date range
  await get('timeline/fbImpressions Canela',
    `https://app.metricool.com/api/stats/timeline/fbImpressions?blogId=6150383&userId=${USER_ID}&start=20260101&end=20260429`)

  await get('timeline/fbImpressions SalCeltica',
    `https://app.metricool.com/api/stats/timeline/fbImpressions?blogId=5418754&userId=${USER_ID}&start=20260101&end=20260429`)

  // 4. FB page views/videoViews — alternative endpoints
  await get('timeline/fbVideoViews SalCeltica',
    `https://app.metricool.com/api/stats/timeline/fbVideoViews?blogId=5418754&userId=${USER_ID}&start=20260101&end=20260429`)

  await get('timeline/fbPageViews SalCeltica',
    `https://app.metricool.com/api/stats/timeline/fbPageViews?blogId=5418754&userId=${USER_ID}&start=20260101&end=20260429`)

  // 5. IG reels — confirm views field totals (ISO format required)
  await get('reels/instagram SalCeltica [ISO]',
    `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=5418754&userId=${USER_ID}&from=${encodeURIComponent('2026-01-01T00:00:00')}&to=${encodeURIComponent('2026-04-29T23:59:59')}`)

  // 6. IG stats profile — may have totalImpressions
  await get('stats/ig profile SalCeltica',
    `https://app.metricool.com/api/stats/igProfile?blogId=5418754&userId=${USER_ID}&start=20260101&end=20260429`)

  await get('stats/fb profile SalCeltica',
    `https://app.metricool.com/api/stats/fbProfile?blogId=5418754&userId=${USER_ID}&start=20260101&end=20260429`)
}

main().catch(console.error)
