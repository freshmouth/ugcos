import { writeFileSync } from 'fs'

const userId = '4210220'
const H = { 'X-Mc-Auth': process.env.METRICOOL_API_KEY!, Accept: 'application/json' }

const end = new Date()
const start = new Date()
start.setDate(start.getDate() - 30)
const fmt = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '')
const S = fmt(start)
const E = fmt(end)

const brands = [
  { label: 'Canela (6150383)', blogId: '6150383' },
  { label: 'Sal Céltica (5418754)', blogId: '5418754' },
]

// v2 reels endpoint uses ISO datetime, not YYYYMMDD
const fmtISO = (d: Date) => d.toISOString().replace('Z', '').split('.')[0]!

async function probe(label: string, url: string): Promise<unknown> {
  const name = url.split('/api/')[1]?.split('?')[0] ?? url
  try {
    const res = await fetch(url, { headers: H })
    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = text.slice(0, 200) }

    console.log(`\n${'='.repeat(60)}`)
    console.log(`[${label}] ${name}  →  HTTP ${res.status}`)

    if (Array.isArray(data)) {
      console.log(`ARRAY LENGTH: ${data.length}`)
      if (data.length > 0) {
        const item = data[0] as Record<string, unknown>
        console.log(`KEYS: ${Object.keys(item).join(', ')}`)
        console.log(`FIRST ITEM (scalars):`)
        for (const [k, v] of Object.entries(item)) {
          if (typeof v === 'number' || typeof v === 'string') {
            console.log(`  ${k}: ${String(v).slice(0, 100)}`)
          } else if (v && typeof v === 'object') {
            console.log(`  ${k}: ${JSON.stringify(v).slice(0, 80)}`)
          }
        }
        // Aggregates
        let sumImp = 0, sumViews = 0, sumReach = 0, sumIT = 0, sumEng = 0, sumReact = 0, sumLikes = 0
        let sumVideoViews = 0, sumImprOrg = 0
        for (const r of data as Record<string, unknown>[]) {
          sumImp += (r.impressions as number) ?? 0
          sumViews += (r.views as number) ?? 0
          sumReach += (r.reach as number) ?? 0
          sumIT += (r.impressionsTotal as number) ?? 0
          sumEng += (r.engagement as number) ?? 0
          sumReact += (r.reactions as number) ?? 0
          sumLikes += (r.likes as number) ?? 0
          sumVideoViews += (r.videoViews as number) ?? 0
          sumImprOrg += (r.impressionsOrganic as number) ?? 0
        }
        const n = data.length
        console.log(`\nAGGREGATES over ${n} items:`)
        if (sumImp)     console.log(`  SUM impressions: ${sumImp.toLocaleString()}`)
        if (sumViews)   console.log(`  SUM views: ${sumViews.toLocaleString()}`)
        if (sumReach)   console.log(`  SUM reach: ${sumReach.toLocaleString()}`)
        if (sumIT)      console.log(`  SUM impressionsTotal: ${sumIT.toLocaleString()}`)
        if (sumEng)     console.log(`  AVG engagement: ${(sumEng / n).toFixed(4)}`)
        if (sumReact)   console.log(`  SUM reactions: ${sumReact.toLocaleString()}`)
        if (sumLikes)   console.log(`  SUM likes: ${sumLikes.toLocaleString()}`)
        if (sumVideoViews) console.log(`  SUM videoViews: ${sumVideoViews.toLocaleString()}`)
        if (sumImprOrg) console.log(`  SUM impressionsOrganic: ${sumImprOrg.toLocaleString()}`)
      }
    } else if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      console.log(`OBJECT KEYS: ${Object.keys(d).join(', ')}`)
      for (const [k, v] of Object.entries(d)) {
        if (typeof v === 'number' || typeof v === 'string') {
          console.log(`  ${k}: ${String(v).slice(0, 120)}`)
        } else if (Array.isArray(v)) {
          console.log(`  ${k}: [array len=${v.length}]`)
        } else if (v && typeof v === 'object') {
          console.log(`  ${k}: ${JSON.stringify(v).slice(0, 80)}`)
        }
      }
    } else {
      console.log(`RESPONSE: ${JSON.stringify(data).slice(0, 300)}`)
    }
    return data
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.log(`ERROR: ${msg}`)
    return null
  }
}

async function main() {
  if (!process.env.METRICOOL_API_KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }
  console.log(`Date range: ${S} → ${E}`)
  console.log(`ISO range: ${fmtISO(start)} → ${fmtISO(end)}`)

  const allResults: Record<string, unknown> = {}

  for (const { label, blogId } of brands) {
    console.log(`\n\n██████ ${label} ██████`)
    const base = `https://app.metricool.com/api`
    const q = `blogId=${blogId}&userId=${userId}&start=${S}&end=${E}`

    // CORRECT endpoints per swagger
    allResults[`${blogId}-ig-reels`]  = await probe(label, `${base}/stats/instagram/reels?${q}`)
    allResults[`${blogId}-ig-posts`]  = await probe(label, `${base}/stats/instagram/posts?${q}`)
    allResults[`${blogId}-fb-posts`]  = await probe(label, `${base}/stats/facebook/posts?${q}`)

    // v2 reels (ISO datetime format used in fix3b)
    const qISO = `blogId=${blogId}&userId=${userId}&from=${encodeURIComponent(fmtISO(start))}&to=${encodeURIComponent(fmtISO(end))}`
    allResults[`${blogId}-ig-reels-v2`] = await probe(label, `${base}/v2/analytics/reels/instagram?${qISO}`)

    // Also try scheduler posts for upcoming schedule
    const nowISO = fmtISO(new Date())
    const futureISO = fmtISO(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    const qSched = `blogId=${blogId}&userId=${userId}&start=${encodeURIComponent(nowISO)}&end=${encodeURIComponent(futureISO)}`
    allResults[`${blogId}-scheduled`] = await probe(label, `${base}/v2/scheduler/posts?${qSched}`)
  }

  writeFileSync('scripts/diagnosis-results.json', JSON.stringify(allResults, null, 2))
  console.log('\n\nFull results saved to scripts/diagnosis-results.json')
}

main().catch(console.error)
