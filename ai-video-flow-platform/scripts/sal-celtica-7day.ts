const blogId = '5418754'
const userId = '4210220'
const H = { 'X-Mc-Auth': process.env.METRICOOL_API_KEY!, Accept: 'application/json' }

const end = new Date()
const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
const fmt = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '')
const S = fmt(start), E = fmt(end)
const fmtISO = (d: Date) => d.toISOString().replace('Z', '').split('.')[0]!

console.log(`Range: ${S} → ${E}  (Sal Céltica blogId=${blogId})`)

const parseArr = (t: string): Record<string, unknown>[] => {
  try {
    const d = JSON.parse(t)
    return Array.isArray(d) ? d : (Array.isArray(d.data) ? d.data : Array.isArray(d.posts) ? d.posts : [])
  } catch { return [] }
}

async function main() {
  const [r1, r2, r3] = await Promise.all([
    fetch(`https://app.metricool.com/api/stats/instagram/reels?blogId=${blogId}&userId=${userId}&start=${S}&end=${E}`, { headers: H }),
    fetch(`https://app.metricool.com/api/stats/facebook/posts?blogId=${blogId}&userId=${userId}&start=${S}&end=${E}`, { headers: H }),
    fetch(`https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=${blogId}&userId=${userId}&from=${encodeURIComponent(fmtISO(start))}&to=${encodeURIComponent(fmtISO(end))}`, { headers: H }),
  ])

  const ig   = parseArr(await r1.text())
  const fb   = parseArr(await r2.text())
  const igV2 = parseArr(await r3.text())

  console.log(`\n── IG Reels (stats/instagram/reels)  HTTP ${r1.status}  count=${ig.length}`)
  let igViews = 0, igLikes = 0, igEng = 0
  for (const r of ig) {
    igViews += (r.views as number) ?? 0
    igLikes += (r.likes as number) ?? 0
    igEng   += (r.engagement as number) ?? 0
    console.log(`  ${r.reelId ?? r.id}: views=${r.views} likes=${r.likes} eng=${typeof r.engagement === 'number' ? (r.engagement as number).toFixed(2) : 0}%`)
  }
  console.log(`  TOTAL IG views: ${igViews}  |  SUM likes: ${igLikes}  |  AVG eng: ${ig.length ? (igEng / ig.length).toFixed(2) : 0}%`)

  console.log(`\n── FB Posts (stats/facebook/posts)  HTTP ${r2.status}  count=${fb.length}`)
  let fbViews = 0, fbReact = 0
  for (const p of fb) {
    fbViews += (p.videoViews as number) ?? 0
    fbReact += (p.reactions as number) ?? 0
    console.log(`  ${p.postId}: videoViews=${p.videoViews} impressions=${p.impressions} reactions=${p.reactions}`)
  }
  console.log(`  TOTAL FB videoViews: ${fbViews}  |  SUM reactions: ${fbReact}`)

  console.log(`\n── IG Reels v2  HTTP ${r3.status}  count=${igV2.length}`)
  let v2Views = 0
  for (const r of igV2) {
    v2Views += (r.views as number) ?? 0
    console.log(`  ${r.reelId}: views=${r.views} impressionsTotal=${r.impressionsTotal} eng=${typeof r.engagement === 'number' ? (r.engagement as number).toFixed(2) : 0}%`)
  }
  console.log(`  TOTAL v2 views: ${v2Views}`)

  console.log(`\n════════════════════════════════════════`)
  console.log(`TOTAL VIEWS for Sal Céltica (last 7 days):`)
  console.log(`  IG reel plays  : ${igViews}`)
  console.log(`  FB video plays : ${fbViews}`)
  console.log(`  COMBINED       : ${igViews + fbViews}`)
}

main().catch(console.error)
