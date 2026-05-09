// Run from apps/web:
//   npx tsx --env-file .env.local scripts/import-metricool-brands.ts

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const METRICOOL_USER_ID = '4210220'
const API_KEY = process.env.METRICOOL_API_KEY!
const HEADERS = { 'X-Mc-Auth': API_KEY, Accept: 'application/json' }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const RAW_FILE = path.join(process.cwd(), 'scripts', 'metricool-brands-raw.json')

type RawBrand = {
  id: number
  label: string
  instagram: string | null
  facebook: string | null
  tiktok: string | null
  timezone: string
}

const BRANDS_TO_IMPORT = [
  {
    blogId: 5418754,
    name: 'Sal Céltica',
    cloudinaryFolder: 'catalog/sal-celtica/',
    productDescription: 'Premium sea salt from Brittany France, rich in 82 essential minerals, unrefined and sun-dried',
    targetAudience: 'Health-conscious women and men 25-45 in Mexico',
    productCategory: 'Food & Beverage',
  },
  {
    blogId: 6150383,
    name: 'Canela de Ceylán',
    cloudinaryFolder: 'catalog/canela-ceylan/',
    productDescription: 'Premium Ceylon cinnamon, natural replacement for common cinnamon, rich in health benefits',
    targetAudience: 'Health-conscious people aged 30+ in Mexico',
    productCategory: 'Food & Beverage',
  },
]

function toYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

async function fetchRecentPosts(blogId: number, brandName: string) {
  const end = new Date()
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const url = new URL('https://app.metricool.com/api/v2/scheduler/posts')
  url.searchParams.set('blogId', String(blogId))
  url.searchParams.set('userId', METRICOOL_USER_ID)
  url.searchParams.set('start', start.toISOString().split('.')[0]!)
  url.searchParams.set('end', end.toISOString().split('.')[0]!)

  const res = await fetch(url.toString(), { headers: HEADERS })
  const text = await res.text()
  console.log(`[POSTS] ${brandName} (${blogId}): status=${res.status}`)

  if (res.ok) {
    try {
      const data = JSON.parse(text) as unknown
      const posts = Array.isArray(data) ? data : ((data as Record<string, unknown>)?.posts ?? (data as Record<string, unknown>)?.data ?? [])
      console.log(`[POSTS] ${brandName}: ${Array.isArray(posts) ? posts.length : 0} posts in last 30 days`)
    } catch {
      console.log(`[POSTS] ${brandName}: non-JSON response:`, text.slice(0, 200))
    }
  } else {
    console.log(`[POSTS] ${brandName}: error:`, text.slice(0, 300))
  }
}

async function fetchStats(blogId: number, brandName: string) {
  const end = new Date()
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const url = new URL('https://app.metricool.com/api/stats/posts')
  url.searchParams.set('blogId', String(blogId))
  url.searchParams.set('userId', METRICOOL_USER_ID)
  url.searchParams.set('start', toYYYYMMDD(start))
  url.searchParams.set('end', toYYYYMMDD(end))

  console.log(`[STATS] ${brandName} → GET ${url.toString()}`)
  const res = await fetch(url.toString(), { headers: HEADERS })
  const text = await res.text()
  console.log(`[STATS] ${brandName}: status=${res.status}`)
  console.log(`[STATS] ${brandName}: full response:`, text.slice(0, 800))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertBrand(supabase: any, brand: typeof BRANDS_TO_IMPORT[0], rawBrand: RawBrand) {
  const igConnected = Boolean(rawBrand.instagram)
  const fbConnected = Boolean(rawBrand.facebook)

  const updateData = {
    name: brand.name,
    metricool_brand_id: String(brand.blogId),
    metricool_blog_name: rawBrand.label,
    instagram_connected: igConnected,
    facebook_connected: fbConnected,
    cloudinary_folder: brand.cloudinaryFolder,
    product_description: brand.productDescription,
    target_audience: brand.targetAudience,
    product_category: brand.productCategory,
    active: true,
    autopilot: false,
  }

  // Try to find existing project by metricool_brand_id
  const { data: byBlogId } = await supabase
    .from('projects')
    .select('id, user_id, name')
    .eq('metricool_brand_id', String(brand.blogId))
    .limit(1)
    .single()

  if (byBlogId) {
    const { error } = await supabase.from('projects').update(updateData).eq('id', byBlogId.id)
    if (error) console.error(`[SUPABASE] Update ${brand.name} failed:`, error.message)
    else console.log(`[SUPABASE] Updated project: ${brand.name} ✓  (id: ${byBlogId.id})`)
    return
  }

  // Try to find by name fragment
  const nameFragment = brand.name.split(' ')[0]!.toLowerCase()
  const { data: byName } = await supabase
    .from('projects')
    .select('id, user_id, name')
    .ilike('name', `%${nameFragment}%`)
    .limit(1)
    .single()

  if (byName) {
    const { error } = await supabase.from('projects').update(updateData).eq('id', byName.id)
    if (error) console.error(`[SUPABASE] Update ${brand.name} (by name) failed:`, error.message)
    else console.log(`[SUPABASE] Updated project: ${brand.name} ✓  (matched "${byName.name}", id: ${byName.id})`)
    return
  }

  // No existing project — INSERT
  console.log(`[SUPABASE] No existing project for ${brand.name} — creating new row`)

  // Get user_id from any existing project
  const { data: anyProject } = await supabase.from('projects').select('user_id').limit(1).single()
  let userId = (anyProject as Record<string, string> | null)?.user_id ?? null

  if (!userId) {
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const first = (users as Array<{ id: string; email?: string }>)[0]
    userId = first?.id ?? null
    if (userId) console.log(`[SUPABASE] Using user: ${first?.email ?? userId}`)
  }

  if (!userId) {
    console.error(`[SUPABASE] Cannot insert ${brand.name}: no user found`)
    return
  }

  const { error } = await supabase.from('projects').insert({
    ...updateData,
    user_id: userId,
    content_types: ['informative'],
    posting_frequency: 'daily',
    posting_time: '09:00',
    script_prompts: [],
  })

  if (error) console.error(`[SUPABASE] Insert ${brand.name} failed:`, error.message)
  else console.log(`[SUPABASE] Created project: ${brand.name} ✓`)
}

async function main() {
  if (!API_KEY) { console.error('METRICOOL_API_KEY not set'); process.exit(1) }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('Supabase env vars missing'); process.exit(1) }

  const rawBrands = JSON.parse(fs.readFileSync(RAW_FILE, 'utf-8')) as RawBrand[]
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  console.log('=== Metricool Brand Import — Steps 2–4 ===')
  console.log(`[METRICOOL] Found ${rawBrands.length} brands in saved data\n`)

  for (const target of BRANDS_TO_IMPORT) {
    const rawBrand = rawBrands.find(b => b.id === target.blogId)
    if (!rawBrand) {
      console.error(`[ERROR] blogId ${target.blogId} not found in raw data`)
      continue
    }

    const igConnected = Boolean(rawBrand.instagram)
    const fbConnected = Boolean(rawBrand.facebook)
    console.log(`\n─── ${target.name} ─── blogId: ${target.blogId}`)
    console.log(`[BRAND] ${target.name} → IG: ${igConnected ? '✓' : '✗'}  FB: ${fbConnected ? '✓' : '✗'}`)

    // Step 3: Fetch posts + stats
    await fetchRecentPosts(target.blogId, target.name)
    await fetchStats(target.blogId, target.name)

    // Step 4: Upsert to Supabase
    await upsertBrand(supabase, target, rawBrand)
  }

  console.log('\n=== Import complete ===')
  process.exit(0)
}

main().catch(err => {
  console.error('\n❌ Unhandled error:', err)
  process.exit(1)
})
