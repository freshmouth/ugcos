// Run: cd apps/web && npx tsx --env-file .env.local scripts/re-caption-video.ts
// Re-submits the existing Cloudinary video to Submagic with hookTitle.top=8 (top of frame),
// then cancels the stale Metricool post and reschedules with the corrected captioned URL.
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { stage06Captions } from '../lib/pipeline/stages/06-captions'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const VIDEO_ROW_ID        = '04cda005-4dda-47ee-9949-636ed0c9b447'
const CLOUDINARY_URL      = 'https://res.cloudinary.com/dcvgrrp3r/video/upload/v1777664746/catalog/98a9cb9b-ac57-4d04-bd03-6bcb0e13a4c1/videos/assembled_04cda005-4dda-47ee-9949-636ed0c9b447.mp4'
const STALE_POST_ID       = '321280688'
const SAL_CELTICA_BLOG_ID = '5418754'
const SAL_CELTICA_PROJECT_ID = '7cbb4343-cf5b-480f-9ee8-c6f41e6c349e'
const USER_ID             = process.env.METRICOOL_USER_ID ?? '4210220'
const METRICOOL_BASE      = 'https://app.metricool.com/api'

function getServiceClient(): SupabaseClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  ) as unknown as SupabaseClient
}

function mcHeaders() {
  return { 'X-Mc-Auth': process.env.METRICOOL_API_KEY!, 'Content-Type': 'application/json', Accept: 'application/json' }
}

async function cancelPost(postId: string): Promise<void> {
  const params = new URLSearchParams({ blogId: SAL_CELTICA_BLOG_ID, userId: USER_ID })
  const res = await fetch(`${METRICOOL_BASE}/v2/scheduler/posts/${postId}?${params}`, {
    method: 'DELETE',
    headers: mcHeaders(),
  })
  const text = await res.text()
  console.log(`[METRICOOL] DELETE ${postId} → ${res.status}: ${text.slice(0, 150)}`)
}

async function generateCaption(productDesc: string, targetAudience: string, hookText: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return `${hookText}\n\nLink en bio 👇\n\n#salceltica #saludable #viral`
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 350,
    messages: [
      {
        role: 'system',
        content: 'You write punchy, conversion-focused social media captions for Instagram Reels and Facebook. Native Mexican/LATAM Spanish. Conversational tone, 120 words max. No markdown, no headers.',
      },
      {
        role: 'user',
        content:
          `Escribe un caption para este video UGC:\n\n` +
          `Producto: ${productDesc}\n` +
          `Audiencia: ${targetAudience}\n` +
          `Hook del video: "${hookText}"\n\n` +
          `Estructura:\n` +
          `1. Abre con el hook (o variación directa)\n` +
          `2. 1-2 frases sobre el beneficio clave del producto\n` +
          `3. CTA corto ("Link en bio 👇" o similar)\n` +
          `4. 6-8 hashtags relevantes en español + nicho\n\n` +
          `Solo devuelve el texto del caption, sin comentarios adicionales.`,
      },
    ],
  })
  const caption = res.choices[0]?.message?.content?.trim()
  if (!caption) throw new Error('GPT-4o returned empty caption')
  return caption
}

async function schedulePost(captionedUrl: string, caption: string): Promise<string> {
  const params = new URLSearchParams({ blogId: SAL_CELTICA_BLOG_ID, userId: USER_ID })
  const scheduledAt = new Date(Date.now() + 2 * 60 * 1000).toISOString().slice(0, 19)
  const body = {
    publicationDate: { dateTime: scheduledAt, timezone: 'America/Mexico_City' },
    text: caption,
    autoPublish: true,
    providers: [{ network: 'instagram' }, { network: 'facebook' }],
    instagramData: { autoPublish: true, type: 'REEL' },
    facebookData: { type: 'POST' },
    media: [captionedUrl],
    creatorUserId: Number(USER_ID),
  }
  const res = await fetch(`${METRICOOL_BASE}/v2/scheduler/posts?${params}`, {
    method: 'POST', headers: mcHeaders(), body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`[METRICOOL] POST → ${res.status}: ${text.slice(0, 300)}`)
  if (!res.ok) throw new Error(`Metricool ${res.status}: ${text.slice(0, 200)}`)
  const data = JSON.parse(text) as Record<string, unknown>
  const inner = (data.data ?? {}) as Record<string, unknown>
  return String(data.postId ?? data.id ?? inner.postId ?? inner.id ?? '')
}

// Minimal ScenePlan stub required by stage06Captions signature
const STUB_PLAN = {
  total_scenes: 1, target_duration_seconds: 16,
  avatar: { description: '', outfit_casual: '', outfit_athletic: '' },
  props: { continuity_prop: '', product_description: '' },
  hook_text: '',
  scenes: [],
} as const

async function main() {
  console.log('=== Re-caption with hookTitle.top=8 ===\n')

  const sbAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const sbService = getServiceClient()

  // Fetch Sal Céltica project details for caption
  const { data: salProject } = await sbAdmin
    .from('projects')
    .select('product_description, target_audience, hooks_library')
    .eq('id', SAL_CELTICA_PROJECT_ID)
    .single()

  const productDesc    = salProject?.product_description ?? 'Sal Céltica Marina Fina — sal marina premium de Bretaña, Francia. Rica en 82 minerales esenciales.'
  const targetAudience = salProject?.target_audience     ?? 'Mujeres conscientes de su salud, 25-40, México y LATAM'
  const hookText       = (salProject?.hooks_library as string[] | null)?.[0] ?? '¿Sabías que la sal de mesa común puede hacerte daño?'

  // Step 1: Re-run Submagic with corrected hook position
  console.log('Step 1: Submitting to Submagic (hookTitle.top=8)...')
  console.log(`  Cloudinary URL: ${CLOUDINARY_URL.slice(0, 80)}...`)

  const { captioned_url } = await stage06Captions(
    CLOUDINARY_URL,
    STUB_PLAN as never,
    '98a9cb9b-ac57-4d04-bd03-6bcb0e13a4c1',
    VIDEO_ROW_ID,
    sbService,
  )
  console.log(`✓ New captioned URL: ${captioned_url.slice(0, 100)}...`)

  // Step 2: Update DB with new captioned_url
  await sbAdmin.from('videos').update({ captioned_url }).eq('id', VIDEO_ROW_ID)
  console.log('✓ DB captioned_url updated')

  // Step 3: Cancel stale Metricool post
  console.log(`\nStep 2: Cancelling stale post ${STALE_POST_ID}...`)
  await cancelPost(STALE_POST_ID)

  // Step 4: Generate caption with GPT-4o
  console.log('\nStep 3: Generating caption with GPT-4o...')
  const caption = await generateCaption(productDesc, targetAudience, hookText)
  console.log('\nCaption:\n─────────────────')
  console.log(caption)
  console.log('─────────────────')

  // Step 5: Schedule to Sal Céltica with corrected video
  console.log('\nStep 4: Scheduling corrected video to Sal Céltica...')
  const newPostId = await schedulePost(captioned_url, caption)
  console.log(`✓ New post ID: ${newPostId}`)

  // Step 6: Update DB
  await sbAdmin.from('videos').update({ metricool_post_id: newPostId }).eq('id', VIDEO_ROW_ID)
  console.log('✓ DB metricool_post_id updated')

  console.log('\n=== Done ===')
  console.log(`Old post ${STALE_POST_ID} → cancelled`)
  console.log(`New post ${newPostId} → scheduled on Sal Céltica`)
  process.exit(0)
}

main().catch(err => {
  console.error('\n❌', err instanceof Error ? err.message : JSON.stringify(err))
  if (err instanceof Error) console.error(err.stack)
  process.exit(1)
})
