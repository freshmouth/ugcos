import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function diagnose() {
  console.log('\n=== SUPABASE DIAGNOSIS ===\n')

  // 1. Check projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, metricool_brand_id, cloudinary_folder, instagram_connected, facebook_connected')
  console.log('[PROJECTS]', JSON.stringify(projects, null, 2))

  // 2. Check videos
  const { data: videos } = await supabase
    .from('videos')
    .select('id, status, cloudinary_url, captioned_url, fal_image_url, metricool_post_id, content_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  console.log('[VIDEOS]', JSON.stringify(videos, null, 2))

  // 3. Check subscriptions
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('*')
  console.log('[SUBSCRIPTIONS]', JSON.stringify(subs, null, 2))

  console.log('\n=== METRICOOL DIAGNOSIS ===\n')

  const headers = { 'X-Mc-Auth': process.env.METRICOOL_API_KEY! }
  const blogId = '6150383'
  const userId = '4210220'
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 30)
  const fmt = (d: Date) => d.toISOString().split('T')[0]!.replace(/-/g, '')

  // Test every Metricool endpoint we need
  const endpoints = [
    {
      name: 'simpleProfiles',
      url: `https://app.metricool.com/api/admin/simpleProfiles?blogId=${blogId}&userId=${userId}`
    },
    {
      name: 'stats/posts (last 30 days)',
      url: `https://app.metricool.com/api/stats/posts?blogId=${blogId}&userId=${userId}&start=${fmt(start)}&end=${fmt(today)}`
    },
    {
      name: 'reels/instagram',
      url: `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=${blogId}&userId=${userId}&from=${fmt(start)}&to=${fmt(today)}`
    },
    {
      name: 'scheduler/posts (next 30 days)',
      url: `https://app.metricool.com/api/v2/scheduler/posts?blogId=${blogId}&userId=${userId}&start=${fmt(today)}&end=${fmt(new Date(today.getTime() + 30*24*60*60*1000))}`
    },
    {
      name: 'timeline/igImpressions',
      url: `https://app.metricool.com/api/stats/timeline/igImpressions?blogId=${blogId}&userId=${userId}&start=${fmt(start)}&end=${fmt(today)}`
    },
    {
      name: 'instagram reels analytics (blogId 5418754)',
      url: `https://app.metricool.com/api/v2/analytics/reels/instagram?blogId=5418754&userId=${userId}&from=${fmt(start)}&to=${fmt(today)}`
    },
    {
      name: 'scheduler/posts blogId 5418754',
      url: `https://app.metricool.com/api/v2/scheduler/posts?blogId=5418754&userId=${userId}&start=${fmt(today)}&end=${fmt(new Date(today.getTime() + 30*24*60*60*1000))}`
    },
    {
      name: 'stats/posts blogId 5418754',
      url: `https://app.metricool.com/api/stats/posts?blogId=5418754&userId=${userId}&start=${fmt(start)}&end=${fmt(today)}`
    },
  ]

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { headers })
      const text = await res.text()
      let parsed: unknown
      try { parsed = JSON.parse(text) } catch { parsed = text.slice(0, 200) }
      console.log(`\n[${ep.name}]`)
      console.log('  Status:', res.status)
      if (Array.isArray(parsed)) {
        console.log('  Count:', parsed.length)
        if (parsed.length > 0) console.log('  First item keys:', Object.keys(parsed[0] as object))
        if (parsed.length > 0) console.log('  First item:', JSON.stringify(parsed[0], null, 2).slice(0, 600))
      } else {
        console.log('  Response:', JSON.stringify(parsed, null, 2).slice(0, 500))
      }
    } catch (e) {
      console.log(`\n[${ep.name}] ERROR:`, (e as Error).message)
    }
  }
}

diagnose().catch(console.error)
