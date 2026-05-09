const blogId = '6150383'
const userId = '4210220'
const headers = { 'X-Mc-Auth': process.env.METRICOOL_API_KEY!, Accept: 'application/json' }

// Last 30 days
const end = new Date()
const start = new Date()
start.setDate(start.getDate() - 30)
const fmt = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '')

const endpoints = [
  // Facebook overview
  `https://app.metricool.com/api/stats/facebook?blogId=${blogId}&userId=${userId}&start=${fmt(start)}&end=${fmt(end)}`,
  // All posts (FB + IG)
  `https://app.metricool.com/api/stats/posts?blogId=${blogId}&userId=${userId}&start=${fmt(start)}&end=${fmt(end)}`,
  // Instagram overview
  `https://app.metricool.com/api/stats/instagram?blogId=${blogId}&userId=${userId}&start=${fmt(start)}&end=${fmt(end)}`,
  // Instagram posts
  `https://app.metricool.com/api/stats/posts/instagram?blogId=${blogId}&userId=${userId}&start=${fmt(start)}&end=${fmt(end)}`,
  // Instagram reels
  `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=${blogId}&userId=${userId}&from=${fmt(start)}&to=${fmt(end)}`,
  // Timeline impressions FB
  `https://app.metricool.com/api/stats/timeline/fbImpressions?blogId=${blogId}&userId=${userId}&start=${fmt(start)}&end=${fmt(end)}`,
  // Timeline impressions IG
  `https://app.metricool.com/api/stats/timeline/igImpressions?blogId=${blogId}&userId=${userId}&start=${fmt(start)}&end=${fmt(end)}`,
]

// Also test Sal Céltica blogId
const salId = '5418754'
const endpointsSal = [
  `https://app.metricool.com/api/stats/facebook?blogId=${salId}&userId=${userId}&start=${fmt(start)}&end=${fmt(end)}`,
  `https://app.metricool.com/api/stats/posts?blogId=${salId}&userId=${userId}&start=${fmt(start)}&end=${fmt(end)}`,
  `https://app.metricool.com/api/stats/instagram?blogId=${salId}&userId=${userId}&start=${fmt(start)}&end=${fmt(end)}`,
  `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=${salId}&userId=${userId}&from=${fmt(start)}&to=${fmt(end)}`,
]

async function probe(label: string, url: string) {
  const name = url.split('/api/')[1]?.split('?')[0] ?? url
  try {
    const res = await fetch(url, { headers })
    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text.slice(0, 200) }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`[${label}] ENDPOINT: ${name}`)
    console.log(`STATUS: ${res.status}`)

    if (Array.isArray(data)) {
      console.log(`ARRAY LENGTH: ${data.length}`)
      if (data.length > 0) {
        const item = data[0] as Record<string, unknown>
        console.log(`KEYS: ${Object.keys(item).join(', ')}`)
        console.log(`FIRST ITEM (scalars):`)
        for (const [k, v] of Object.entries(item)) {
          if (typeof v === 'number' || typeof v === 'string') {
            console.log(`  ${k}: ${String(v).slice(0, 120)}`)
          }
        }
        // Print all items' views-like fields to sum them
        let sumImp = 0, sumViews = 0, sumReach = 0, sumIT = 0, sumER = 0
        for (const r of data as Record<string, unknown>[]) {
          sumImp += (r.impressions as number) ?? 0
          sumViews += (r.views as number) ?? 0
          sumReach += (r.reach as number) ?? 0
          sumIT += (r.impressionsTotal as number) ?? 0
          sumER += (r.engagementRate as number) ?? 0
        }
        if (data.length > 1) {
          console.log(`\nAGGREGATES across ${data.length} items:`)
          console.log(`  SUM impressions: ${sumImp.toLocaleString()}`)
          console.log(`  SUM views: ${sumViews.toLocaleString()}`)
          console.log(`  SUM reach: ${sumReach.toLocaleString()}`)
          console.log(`  SUM impressionsTotal: ${sumIT.toLocaleString()}`)
          console.log(`  AVG engagementRate: ${data.length > 0 ? (sumER / data.length).toFixed(4) : 0}`)
        }
      }
    } else if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      console.log(`OBJECT KEYS: ${Object.keys(d).join(', ')}`)
      for (const [k, v] of Object.entries(d)) {
        if (typeof v === 'number' || typeof v === 'string') {
          console.log(`  ${k}: ${String(v).slice(0, 120)}`)
        } else if (Array.isArray(v)) {
          console.log(`  ${k}: [array, length=${v.length}]`)
        }
      }
    } else {
      console.log(`RESPONSE: ${JSON.stringify(data).slice(0, 300)}`)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`\n[${label}] ENDPOINT: ${name} → ERROR: ${msg}`)
  }
}

async function main() {
  if (!process.env.METRICOOL_API_KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }
  console.log(`Date range: ${fmt(start)} → ${fmt(end)}`)

  console.log('\n\n██████████ BRAND: blogId=6150383 ██████████')
  for (const url of endpoints) await probe('6150383', url)

  console.log('\n\n██████████ BRAND: blogId=5418754 (Sal Céltica) ██████████')
  for (const url of endpointsSal) await probe('5418754', url)
}

main().catch(console.error)
