// Run: cd apps/web && npx tsx --env-file .env.local scripts/test-metricool.ts
const BLOG_ID = process.env.METRICOOL_BLOG_ID ?? '6150383'
const USER_ID = process.env.METRICOOL_USER_ID ?? '4210220'
const API_KEY = process.env.METRICOOL_API_KEY

async function main() {
  console.log('Testing Metricool API connection...')
  console.log('METRICOOL_API_KEY present:', Boolean(API_KEY))
  console.log('METRICOOL_BLOG_ID:', BLOG_ID)
  console.log('METRICOOL_USER_ID:', USER_ID)

  if (!API_KEY) {
    console.error('METRICOOL_API_KEY is not set — cannot proceed')
    process.exit(1)
  }

  const headers = { Authorization: `Bearer ${API_KEY}` }

  // Test 1: Analytics
  console.log('\n[TEST 1] GET /api/v2/stats/analytics')
  try {
    const url = new URL('https://app.metricool.com/api/v2/stats/analytics')
    url.searchParams.set('blogId', BLOG_ID)
    url.searchParams.set('userId', USER_ID)
    const res = await fetch(url.toString(), { headers })
    const text = await res.text()
    console.log('  Status:', res.status)
    console.log('  Body:', text.slice(0, 500))
  } catch (err) {
    console.error('  Error:', err)
  }

  // Test 2: Scheduled posts
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 30)
  const end = new Date(today)
  end.setDate(end.getDate() + 30)
  const startDate = start.toISOString().split('T')[0]!
  const endDate = end.toISOString().split('T')[0]!

  console.log(`\n[TEST 2] GET /api/v2/scheduler/posts (${startDate} → ${endDate})`)
  try {
    const url = new URL('https://app.metricool.com/api/v2/scheduler/posts')
    url.searchParams.set('blogId', BLOG_ID)
    url.searchParams.set('startDate', startDate)
    url.searchParams.set('endDate', endDate)
    const res = await fetch(url.toString(), { headers })
    const text = await res.text()
    console.log('  Status:', res.status)
    console.log('  Body:', text.slice(0, 1000))
  } catch (err) {
    console.error('  Error:', err)
  }

  // Test 3: Published posts history
  console.log('\n[TEST 3] GET /api/v2/stats/posts')
  try {
    const url = new URL('https://app.metricool.com/api/v2/stats/posts')
    url.searchParams.set('blogId', BLOG_ID)
    url.searchParams.set('startDate', '2025-01-01')
    url.searchParams.set('endDate', '2025-12-31')
    const res = await fetch(url.toString(), { headers })
    const text = await res.text()
    console.log('  Status:', res.status)
    console.log('  Body:', text.slice(0, 1000))
  } catch (err) {
    console.error('  Error:', err)
  }

  // Test 4: Try posting (only if TEST_POST=1)
  if (process.env.TEST_POST === '1') {
    console.log('\n[TEST 4] POST /api/v2/scheduler/posts (test video)')
    try {
      const scheduledAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19)
      const body = {
        blogId: Number(BLOG_ID),
        networks: ['instagram', 'facebook'],
        type: 'video',
        videoUrl: 'https://res.cloudinary.com/demo/video/upload/dog.mp4',
        text: 'Test post from UGC.OS pipeline 🎬',
        date: scheduledAt,
        timezone: 'America/Mexico_City',
      }
      console.log('  Request body:', JSON.stringify(body, null, 2))
      const res = await fetch('https://app.metricool.com/api/v2/scheduler/posts', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      console.log('  Status:', res.status)
      console.log('  Body:', text.slice(0, 1000))
    } catch (err) {
      console.error('  Error:', err)
    }
  }

  console.log('\nMetricool test complete.')
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Unhandled error:', err)
  process.exit(1)
})
