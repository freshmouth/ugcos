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
        console.log(`  first: ${JSON.stringify(first, null, 2).slice(0, 800)}`)
        if ('picture' in first) console.log(`  Has picture: ${!!first.picture}`)
        if ('thumbnail' in first) console.log(`  Has thumbnail: ${!!first.thumbnail}`)
        if ('link' in first) console.log(`  Has link: ${!!first.link}`)
        if ('videoUrl' in first) console.log(`  Has videoUrl: ${!!first.videoUrl}`)
      } else {
        // array of arrays — sum second element
        const total = (data as [string, string][]).reduce((s, row) => s + (parseFloat(row[1] ?? '0') || 0), 0)
        console.log(`  sample: ${JSON.stringify(data.slice(0,4))}`)
        console.log(`  SUM of values: ${total.toLocaleString()}`)
      }
    }
  } else {
    console.log(`  response: ${JSON.stringify(data).slice(0, 400)}`)
  }
}

async function main() {
  if (!API_KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }

  const start = '20260101'
  const end   = '20260429'

  // Stats/posts for both brands (wide date range to find ANY posts)
  await get('stats/posts canela [20260101-20260429]',
    `https://app.metricool.com/api/stats/posts?blogId=6150383&userId=4210220&start=${start}&end=${end}`)

  await get('stats/posts salceltica [20260101-20260429]',
    `https://app.metricool.com/api/stats/posts?blogId=5418754&userId=4210220&start=${start}&end=${end}`)

  // Timeline impressions — FB and IG
  await get('timeline/fbImpressions canela',
    `https://app.metricool.com/api/stats/timeline/fbImpressions?blogId=6150383&userId=4210220&start=${start}&end=${end}`)

  await get('timeline/fbImpressions salceltica',
    `https://app.metricool.com/api/stats/timeline/fbImpressions?blogId=5418754&userId=4210220&start=${start}&end=${end}`)

  await get('timeline/igImpressions canela',
    `https://app.metricool.com/api/stats/timeline/igImpressions?blogId=6150383&userId=4210220&start=${start}&end=${end}`)

  await get('timeline/igImpressions salceltica',
    `https://app.metricool.com/api/stats/timeline/igImpressions?blogId=5418754&userId=4210220&start=${start}&end=${end}`)

  // Scheduler posts (ISO format)
  const nowIso = new Date().toISOString().replace('Z','').split('.')[0]
  const futureIso = new Date(Date.now() + 30*86400000).toISOString().replace('Z','').split('.')[0]
  await get('scheduler/posts canela next30d',
    `https://app.metricool.com/api/v2/scheduler/posts?blogId=6150383&userId=4210220&start=${encodeURIComponent(nowIso!)}&end=${encodeURIComponent(futureIso!)}`)

  await get('scheduler/posts salceltica next30d',
    `https://app.metricool.com/api/v2/scheduler/posts?blogId=5418754&userId=4210220&start=${encodeURIComponent(nowIso!)}&end=${encodeURIComponent(futureIso!)}`)
}

main().catch(console.error)
