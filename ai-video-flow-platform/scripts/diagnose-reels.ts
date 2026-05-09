const KEY = process.env.METRICOOL_API_KEY!

async function run() {
  const r = await fetch(
    'https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=5418754&userId=4210220&from=2026-01-01T00:00:00&to=2026-04-29T23:59:59',
    { headers: { 'X-Mc-Auth': KEY, Accept: 'application/json' } }
  )
  const text = await r.text()
  const body = JSON.parse(text) as { data?: unknown[] } | unknown[]
  const arr: Record<string, unknown>[] = Array.isArray(body) ? (body as Record<string, unknown>[]) : ((body as { data?: Record<string, unknown>[] }).data ?? [])

  console.log('count:', arr.length)
  if (arr.length > 0) {
    const f = arr[0]!
    console.log('\nALL KEYS:', Object.keys(f).join(', '))
    for (const [k, v] of Object.entries(f)) {
      console.log(`  ${k}: ${JSON.stringify(v)}`)
    }

    let imp = 0, rea = 0, pla = 0, vie = 0, eng = 0, er = 0
    for (const x of arr) {
      imp += (x.impressions as number) ?? 0
      rea += (x.reach as number) ?? 0
      pla += (x.plays as number) ?? 0
      vie += ((x.views as number) ?? (x.videoViews as number) ?? 0)
      eng += (x.engagement as number) ?? 0
      er  += (x.engagementRate as number) ?? (x.er as number) ?? 0
    }
    console.log('\n--- TOTALS across', arr.length, 'reels ---')
    console.log('impressions:', imp)
    console.log('reach:', rea)
    console.log('plays:', pla)
    console.log('views/videoViews:', vie)
    console.log('engagement:', eng)
    console.log('avg engagementRate:', arr.length > 0 ? (er / arr.length).toFixed(2) : 0)
  }

  // Also check if reels have imageUrl
  const withImage = arr.filter(r => r.imageUrl || r.thumbnail || r.picture)
  console.log('\nReels with imageUrl/thumbnail/picture:', withImage.length, 'of', arr.length)
  if (withImage.length > 0) {
    console.log('imageUrl sample:', (withImage[0]!.imageUrl ?? withImage[0]!.thumbnail ?? withImage[0]!.picture))
  }

  // Show last 5 reels for schedule widget
  console.log('\n--- LAST 5 REELS (for schedule) ---')
  for (const reel of arr.slice(0, 5)) {
    console.log(`  ${JSON.stringify(reel.publishedAt)} | ${String(reel.content).slice(0,40)} | ${reel.imageUrl ? 'has image' : 'no image'}`)
  }
}

run().catch(console.error)
