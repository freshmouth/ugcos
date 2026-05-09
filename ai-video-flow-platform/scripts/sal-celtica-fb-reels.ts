const blogId = '5418754'
const userId = '4210220'
const H = { 'X-Mc-Auth': process.env.METRICOOL_API_KEY!, Accept: 'application/json' }

const end = new Date()
const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
const fmtISO = (d: Date) => d.toISOString().replace('Z', '').split('.')[0]!
const FROM = fmtISO(start), TO = fmtISO(end)

const parseArr = (t: string): Record<string, unknown>[] => {
  try {
    const d = JSON.parse(t)
    return Array.isArray(d) ? d : (Array.isArray(d.data) ? d.data : [])
  } catch { return [] }
}

async function probe(label: string, url: string) {
  const res = await fetch(url, { headers: H })
  const text = await res.text()
  const arr = parseArr(text)
  console.log(`\n── ${label}  HTTP ${res.status}  count=${arr.length}`)
  if (arr.length === 0 && res.status !== 200) {
    console.log(`  raw: ${text.slice(0, 200)}`)
  }
  for (const item of arr) {
    console.log(`  ─ item keys: ${Object.keys(item).join(', ')}`)
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === 'number' || typeof v === 'string') {
        console.log(`    ${k}: ${String(v).slice(0, 100)}`)
      } else if (v && typeof v === 'object') {
        console.log(`    ${k}: ${JSON.stringify(v).slice(0, 80)}`)
      }
    }
  }
  return arr
}

async function main() {
  if (!process.env.METRICOOL_API_KEY) { console.error('No API key'); process.exit(1) }
  const base = `https://app.metricool.com/api`
  const q = `blogId=${blogId}&userId=${userId}&from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}`

  console.log(`Sal Céltica (blogId=${blogId})  |  ${FROM} → ${TO}`)

  const [reels, posts, stories] = await Promise.all([
    probe('FB Reels  (v2/analytics/reels/facebook)', `${base}/v2/analytics/reels/facebook?${q}`),
    probe('FB Posts  (v2/analytics/posts/facebook)', `${base}/v2/analytics/posts/facebook?${q}`),
    probe('FB Stories (v2/analytics/stories/facebook)', `${base}/v2/analytics/stories/facebook?${q}`),
  ])

  // Also try 30-day range to find older content
  const start30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const q30 = `blogId=${blogId}&userId=${userId}&from=${encodeURIComponent(fmtISO(start30))}&to=${encodeURIComponent(TO)}`
  const reels30 = await probe('FB Reels 30-day (v2/analytics/reels/facebook)', `${base}/v2/analytics/reels/facebook?${q30}`)

  console.log(`\n════════════════════════════════════════`)
  const reelViews = reels.reduce((s, r) => s + ((r.blueReelsPlayCount as number) ?? 0), 0)
  const postViews = posts.reduce((s, p) => s + ((p.videoViews as number) ?? (p.views as number) ?? 0), 0)
  const reel30Views = reels30.reduce((s, r) => s + ((r.blueReelsPlayCount as number) ?? 0), 0)
  console.log(`FB Reels plays (7d):  ${reelViews}  (blueReelsPlayCount)`)
  console.log(`FB Posts plays (7d):  ${postViews}  (videoViews)`)
  console.log(`FB Stories (7d):      ${stories.length} items`)
  console.log(`FB Reels plays (30d): ${reel30Views}`)
}

main().catch(console.error)
