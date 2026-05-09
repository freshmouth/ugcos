import OpenAI from 'openai'
import { schedulePost } from '../../metricool/schedule'
import type { ScenePlan, Project } from '../types'

export type PublishResult = {
  post_ids: string[]
}

export async function stage07Publish(
  project: Project,
  captionedUrl: string,
  plan: ScenePlan
): Promise<PublishResult> {
  const blogId = project.metricool_brand_id ?? process.env.METRICOOL_BLOG_ID ?? null
  if (!process.env.METRICOOL_API_KEY || !blogId) {
    console.warn('[PIPELINE] Stage 7: METRICOOL_API_KEY or blogId not set, skipping publish')
    return { post_ids: [] }
  }

  // Determine target networks — default to both if no explicit connections set
  const networks: string[] = []
  if (project.instagram_connected) networks.push('instagram')
  if (project.facebook_connected) networks.push('facebook')
  if (!networks.length) {
    // Fallback: attempt posting to all available networks
    console.log('[PIPELINE] Stage 7: No networks explicitly connected, attempting instagram+facebook')
    networks.push('instagram', 'facebook')
  }

  const caption = await generateCaption(project, plan)
  const scheduledAt = new Date(Date.now() + 2 * 60 * 1000).toISOString().slice(0, 19)

  try {
    const result = await schedulePost({
      blogId,
      videoUrl: captionedUrl,
      text: caption,
      networks,
      scheduledAt,
      timezone: 'America/Mexico_City',
    })
    return { post_ids: result.post_ids }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Metricool failure is non-fatal — video is already assembled and captioned
    console.warn('[PIPELINE] Stage 7: Metricool publish failed (non-fatal):', msg)
    return { post_ids: [] }
  }
}

async function generateCaption(project: Project, plan: ScenePlan): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[PUBLISH] OPENAI_API_KEY not set — using fallback caption')
    return fallbackCaption(plan)
  }
  try {
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
            `Producto: ${project.product_description ?? 'Producto premium'}\n` +
            `Audiencia: ${project.target_audience ?? 'Consumidores conscientes de su salud'}\n` +
            `Hook del video: "${plan.hook_text}"\n\n` +
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
    if (!caption) throw new Error('empty response')
    console.log('[PUBLISH] GPT-4o caption generated')
    return caption
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[PUBLISH] Caption generation failed, using fallback:', msg)
    return fallbackCaption(plan)
  }
}

function fallbackCaption(plan: ScenePlan): string {
  return `${plan.hook_text}\n\nLink en bio para más info 👇\n\n#ugc #viral #fyp #trending`
}
