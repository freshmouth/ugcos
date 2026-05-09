const API_KEY = process.env.METRICOOL_API_KEY!
const H = { 'X-Mc-Auth': API_KEY, Accept: 'application/json' }

async function get(label: string, url: string) {
  const res = await fetch(url, { headers: H })
  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = text.slice(0, 300) }
  console.log(`\n[${label}] status=${res.status}`)
  if (Array.isArray(data)) {
    console.log(`  count: ${data.length}`)
    if (data.length > 0) {
      const first = data[0] as Record<string, unknown>
      if (typeof first === 'object' && !Array.isArray(first)) {
        console.log(`  keys: ${Object.keys(first).join(', ')}`)
        console.log(`  first item: ${JSON.stringify(first, null, 2).slice(0, 1000)}`)
        const totImpressions = (data as Record<string,unknown>[]).reduce((s, r) => s + ((r.impressions as number) ?? (r.views as number) ?? 0), 0)
        if (totImpressions > 0) console.log(`  TOTAL impressions: ${totImpressions.toLocaleString()}`)
      } else {
        const total = (data as [string, string][]).reduce((s, row) => s + (parseFloat(row[1] ?? '0') || 0), 0)
        console.log(`  sample[0..3]: ${JSON.stringify(data.slice(0,4))}`)
        console.log(`  SUM: ${total.toLocaleString()}`)
      }
    }
  } else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (d.data) {
      const arr = Array.isArray(d.data) ? d.data : []
      console.log(`  data.length: ${arr.length}`)
      if (arr.length > 0) console.log(`  first: ${JSON.stringify(arr[0]).slice(0, 500)}`)
    } else {
      console.log(`  response: ${JSON.stringify(data).slice(0, 500)}`)
    }
  } else {
    console.log(`  raw: ${String(data).slice(0, 300)}`)
  }
}

async function main() {
  if (!API_KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }

  // Reels with ISO datetime (correct format)
  await get('reels/instagram salceltica ISO [last 90d]',
    `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=5418754&userId=4210220&from=2025-01-01T00%3A00%3A00&to=2026-04-29T23%3A59%3A59`)

  await get('reels/instagram canela ISO [last 90d]',
    `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=6150383&userId=4210220&from=2025-01-01T00%3A00%3A00&to=2026-04-29T23%3A59%3A59`)

  // FB stats with wider range
  await get('timeline/fbImpressions salceltica [2025]',
    `https://app.metricool.com/api/stats/timeline/fbImpressions?blogId=5418754&userId=4210220&start=20250101&end=20260429`)

  await get('timeline/igImpressions salceltica [2025]',
    `https://app.metricool.com/api/stats/timeline/igImpressions?blogId=5418754&userId=4210220&start=20250101&end=20260429`)

  // Stats/posts all time
  await get('stats/posts salceltica [2025-2026]',
    `https://app.metricool.com/api/stats/posts?blogId=5418754&userId=4210220&start=20250101&end=20260429`)

  // Try fbReels / videoViews
  await get('timeline/fbVideoViews salceltica',
    `https://app.metricool.com/api/stats/timeline/fbVideoViews?blogId=5418754&userId=4210220&start=20250101&end=20260429`)

  await get('timeline/fbReach salceltica',
    `https://app.metricool.com/api/stats/timeline/fbReach?blogId=5418754&userId=4210220&start=20250101&end=20260429`)
}

main().catch(console.error)
