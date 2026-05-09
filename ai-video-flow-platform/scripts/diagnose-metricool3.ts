const API_KEY = process.env.METRICOOL_API_KEY!
const H = { 'X-Mc-Auth': API_KEY, Accept: 'application/json' }

async function main() {
  if (!API_KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }

  // Full reels response for Sal Céltica
  const r1 = await fetch(
    'https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=5418754&userId=4210220&from=2026-01-01T00%3A00%3A00&to=2026-04-29T23%3A59%3A59',
    { headers: H }
  )
  const d1 = await r1.json() as unknown[]
  console.log('\n[Sal Céltica reels] count:', d1.length)
  if (d1.length > 0) {
    const first = d1[0] as Record<string, unknown>
    console.log('ALL KEYS:', Object.keys(first).join(', '))
    console.log('FULL FIRST REEL:', JSON.stringify(first, null, 2))

    // Sum all impression fields
    let totalImpressions = 0, totalViews = 0, totalReach = 0, totalPlays = 0
    for (const r of d1) {
      const reel = r as Record<string, number>
      totalImpressions += reel.impressions ?? 0
      totalViews += reel.views ?? reel.videoViews ?? 0
      totalReach += reel.reach ?? 0
      totalPlays += reel.plays ?? reel.totalPlays ?? 0
    }
    console.log('\nTotals across all 39 reels:')
    console.log('  impressions:', totalImpressions.toLocaleString())
    console.log('  views/videoViews:', totalViews.toLocaleString())
    console.log('  reach:', totalReach.toLocaleString())
    console.log('  plays/totalPlays:', totalPlays.toLocaleString())
  }

  // Also get Canela reels full
  const r2 = await fetch(
    'https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=6150383&userId=4210220&from=2026-01-01T00%3A00%3A00&to=2026-04-29T23%3A59%3A59',
    { headers: H }
  )
  const d2 = await r2.json() as unknown[]
  console.log('\n[Canela reels] count:', d2.length)
  if (d2.length > 0) {
    const first = d2[0] as Record<string, unknown>
    console.log('FULL FIRST REEL:', JSON.stringify(first, null, 2))
  }

  // Also test scheduler with correct URL-encoded ISO format
  const nowIso = encodeURIComponent('2026-04-29T00:00:00')
  const futIso = encodeURIComponent('2026-05-29T23:59:59')
  const r3 = await fetch(
    `https://app.metricool.com/api/v2/scheduler/posts?blogId=5418754&userId=4210220&start=${nowIso}&end=${futIso}`,
    { headers: H }
  )
  const d3 = await r3.json() as unknown
  console.log('\n[Scheduler Sal Céltica]:', JSON.stringify(d3).slice(0, 300))
}

main().catch(console.error)
