// Run: cd apps/web && npx tsx --env-file .env.local scripts/fix-post-account.ts
// Cancels the mis-posted Canela de Ceylán post and re-publishes to Sal Céltica
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const WRONG_POST_ID    = '321277875'
const WRONG_BLOG_ID    = '6150383'   // Canela de Ceylán
const SAL_CELTICA_BLOG_ID = '5418754' // Sal Céltica
const VIDEO_ROW_ID     = '04cda005-4dda-47ee-9949-636ed0c9b447'
const USER_ID          = process.env.METRICOOL_USER_ID ?? '4210220'
const API_KEY          = process.env.METRICOOL_API_KEY!
const METRICOOL_BASE   = 'https://app.metricool.com/api'

function mcHeaders() {
  return { 'X-Mc-Auth': API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }
}

async function cancelPost(postId: string, blogId: string): Promise<void> {
  const params = new URLSearchParams({ blogId, userId: USER_ID })
  const res = await fetch(`${METRICOOL_BASE}/v2/scheduler/posts/${postId}?${params}`, {
    method: 'DELETE',
    headers: mcHeaders(),
  })
  const text = await res.text()
  console.log(`[METRICOOL] DELETE post ${postId} → ${res.status}: ${text.slice(0, 200)}`)
  if (!res.ok && res.status !== 404) {
    console.warn(`[METRICOOL] Could not delete post (${res.status}) — it may have already published or been removed`)
  }
}

async function generateCaption(productDesc: string, targetAudience: string, hookText: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[CAPTION] OPENAI_API_KEY not set — using fallback')
    return `${hookText}\n\nLink en bio para más info 👇\n\n#salceltica #salmarinarosa #saludable #alimentacionnatural #ugc #viral`
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 350,
    messages: [
      {
        role: 'system',
        content:
          'You write punchy, conversion-focused social media captions for Instagram Reels and Facebook. ' +
          'Native Mexican/LATAM Spanish. Conversational tone, 120 words max. No markdown, no headers.',
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

async function scheduleToSalCeltica(captionedUrl: string, caption: string): Promise<string> {
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

  console.log('[METRICOOL] Scheduling to Sal Céltica...')
  const res = await fetch(`${METRICOOL_BASE}/v2/scheduler/posts?${params}`, {
    method: 'POST',
    headers: mcHeaders(),
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`[METRICOOL] scheduler/posts → ${res.status}: ${text.slice(0, 300)}`)
  if (!res.ok) throw new Error(`Metricool POST ${res.status}: ${text.slice(0, 300)}`)

  const data = JSON.parse(text) as Record<string, unknown>
  const inner = (data.data ?? {}) as Record<string, unknown>
  return String(data.postId ?? data.id ?? inner.postId ?? inner.id ?? '')
}

async function main() {
  console.log('=== Fix: Re-publish to Sal Céltica ===\n')

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Get video row + Sal Céltica project
  const { data: video } = await sb
    .from('videos')
    .select('captioned_url')
    .eq('id', VIDEO_ROW_ID)
    .single()

  if (!video?.captioned_url) {
    console.error('❌ No captioned_url found on video row — run the pipeline first')
    process.exit(1)
  }

  const { data: salProject } = await sb
    .from('projects')
    .select('product_description, target_audience, hooks_library')
    .eq('id', '7cbb4343-cf5b-480f-9ee8-c6f41e6c349e')
    .single()

  const productDesc    = salProject?.product_description ?? 'Sal Céltica Marina Fina — sal marina premium de Bretaña, Francia. Rica en 82 minerales esenciales. Sin refinar, secada al sol, cosechada de forma natural.'
  const targetAudience = salProject?.target_audience     ?? 'Mujeres conscientes de su salud, 25-40, México y LATAM'
  const hookText       = (salProject?.hooks_library as string[] | null)?.[0] ?? '¿Sabías que la sal de mesa común puede hacerte daño?'

  console.log(`Captioned URL: ${video.captioned_url.slice(0, 80)}...`)
  console.log(`Product: ${productDesc.slice(0, 60)}...`)

  // Step 1: Cancel the wrong post
  console.log(`\nStep 1: Cancelling post ${WRONG_POST_ID} from Canela de Ceylán (${WRONG_BLOG_ID})`)
  await cancelPost(WRONG_POST_ID, WRONG_BLOG_ID)

  // Step 2: Generate caption with GPT-4o
  console.log('\nStep 2: Generating caption with GPT-4o...')
  const caption = await generateCaption(productDesc, targetAudience, hookText)
  console.log('\nGenerated caption:\n─────────────────')
  console.log(caption)
  console.log('─────────────────')

  // Step 3: Post to Sal Céltica
  console.log('\nStep 3: Scheduling to Sal Céltica...')
  const newPostId = await scheduleToSalCeltica(video.captioned_url, caption)
  console.log(`✓ New post ID: ${newPostId}`)

  // Step 4: Update DB
  await sb.from('videos').update({
    metricool_post_id: newPostId,
    error_message: null,
  }).eq('id', VIDEO_ROW_ID)
  console.log('✓ DB updated')

  console.log('\n=== Done ===')
  console.log(`Post ${WRONG_POST_ID} (Canela) → cancelled`)
  console.log(`Post ${newPostId} (Sal Céltica) → scheduled`)
  process.exit(0)
}

main().catch(err => {
  console.error('\n❌', err)
  process.exit(1)
})
