import { fal } from '@fal-ai/client'
import { v2 as cloudinary } from 'cloudinary'
import { createServerClient } from '@supabase/ssr'

fal.config({ credentials: process.env.FAL_KEY })

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

async function updateVideoStatus(videoId: string, status: string, extra?: Record<string, unknown>) {
  const supabase = getServiceClient()
  await supabase.from('videos').update({ status, ...extra }).eq('id', videoId)
}

type PipelineOptions = {
  project: {
    id: string
    user_id: string
    name: string
    product_description?: string | null
    target_audience?: string | null
    content_types: string[]
    script_prompts: string[]
    system_prompt?: string | null
    cloudinary_folder?: string | null
    metricool_brand_id?: string | null
    instagram_connected: boolean
    facebook_connected: boolean
  }
  userId: string
  videoId: string
  contentType: string
  customPrompt?: string
  imageId?: string
  triggeredBy: 'manual' | 'cron'
}

export async function runPipeline(options: PipelineOptions): Promise<{ success: boolean; error?: string }> {
  const { project, userId, videoId, contentType, customPrompt, imageId } = options
  const supabase = getServiceClient()

  try {
    // ─── STEP 1: Image generation ───────────────────────────────────────────
    await updateVideoStatus(videoId, 'generating')

    let productImageUrl: string | null = null
    if (imageId) {
      const { data } = await supabase.from('product_images').select('url').eq('id', imageId).single()
      productImageUrl = data?.url ?? null
    } else {
      const { data } = await supabase.from('product_images').select('url').eq('project_id', project.id).limit(10)
      if (data && data.length > 0) {
        productImageUrl = (data[Math.floor(Math.random() * data.length)] as { url: string }).url
      }
    }

    let falImageUrl: string | null = null
    if (productImageUrl) {
      const imagePrompt = [
        project.system_prompt,
        `Product: ${project.name}`,
        project.product_description,
        contentType,
      ].filter(Boolean).join('. ')

      const imageResult = await fal.subscribe('fal-ai/flux/schnell', {
        input: {
          prompt: imagePrompt,
          image_size: { width: 1080, height: 1920 },
        },
      }) as { images?: Array<{ url: string }> }

      falImageUrl = imageResult?.images?.[0]?.url ?? productImageUrl
    }

    await updateVideoStatus(videoId, 'generating', { fal_image_url: falImageUrl })

    // ─── STEP 2: Video generation (Sora 2 — duration ALWAYS 15) ─────────────
    await updateVideoStatus(videoId, 'processing')

    let scriptPrompt = customPrompt
    if (!scriptPrompt && project.script_prompts.length > 0) {
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
      scriptPrompt = project.script_prompts[dayOfYear % project.script_prompts.length]
    }
    if (!scriptPrompt) {
      scriptPrompt = `${project.name} — ${contentType} content. ${project.product_description ?? ''}`
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoInput: Record<string, any> = {
      prompt: scriptPrompt,
      duration: 15,           // ALWAYS 15 — non-negotiable
      aspect_ratio: '9:16',
    }
    if (falImageUrl) videoInput.image_url = falImageUrl

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoResult = await (fal.subscribe as any)('fal-ai/sora-2/image-to-video', {
      input: videoInput,
    })

    const falVideoUrl: string = videoResult?.video?.url ?? videoResult?.video_url ?? ''
    if (!falVideoUrl) throw new Error('FAL video generation returned no URL')

    await updateVideoStatus(videoId, 'processing', { fal_video_url: falVideoUrl, script_prompt: scriptPrompt })

    // ─── STEP 3: Cloudinary upload ───────────────────────────────────────────
    await updateVideoStatus(videoId, 'uploading')

    const folder = `${project.cloudinary_folder ?? `catalog/${project.id}/`}videos`
    const uploadResult = await cloudinary.uploader.upload(falVideoUrl, {
      resource_type: 'video',
      folder,
      tags: [project.id, userId, contentType],
    })
    const cloudinaryUrl = uploadResult.secure_url
    await updateVideoStatus(videoId, 'uploading', { cloudinary_url: cloudinaryUrl })

    // ─── STEP 4: Submagic captions ───────────────────────────────────────────
    await updateVideoStatus(videoId, 'captioning')

    let captionedUrl = cloudinaryUrl
    if (process.env.SUBMAGIC_API_KEY) {
      try {
        const submagicRes = await fetch('https://api.submagic.co/captions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUBMAGIC_API_KEY}`,
          },
          body: JSON.stringify({ video_url: cloudinaryUrl, style: 'hook' }),
        })
        if (submagicRes.ok) {
          const submagicData = await submagicRes.json() as { captioned_url?: string; url?: string }
          captionedUrl = submagicData.captioned_url ?? submagicData.url ?? cloudinaryUrl
        }
      } catch {
        // Submagic failure is non-blocking; use cloudinary URL
      }
    }
    await updateVideoStatus(videoId, 'captioning', { captioned_url: captionedUrl })

    // ─── STEP 5: Metricool post ──────────────────────────────────────────────
    await updateVideoStatus(videoId, 'posting')

    let metricoolPostId: string | null = null
    if (project.metricool_brand_id && (project.instagram_connected || project.facebook_connected)) {
      try {
        const networks: string[] = []
        if (project.instagram_connected) networks.push('instagram')
        if (project.facebook_connected) networks.push('facebook')

        // Schedule 5 minutes from now
        const scheduledAt = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 19)

        const metricoolRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/metricool/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blogId: project.metricool_brand_id,
            videoUrl: captionedUrl,
            text: scriptPrompt.slice(0, 2200),
            scheduledAt,
            timezone: 'America/Mexico_City',
            networks,
          }),
        })
        if (metricoolRes.ok) {
          const metricoolData = await metricoolRes.json() as { results?: Array<{ postId?: string }> }
          metricoolPostId = metricoolData.results?.[0]?.postId ?? null
        }
      } catch {
        // Metricool failure logged but non-blocking
      }
    }

    // ─── STEP 6: Done ────────────────────────────────────────────────────────
    await updateVideoStatus(videoId, 'done', { metricool_post_id: metricoolPostId })
    return { success: true }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await updateVideoStatus(videoId, 'failed', { error_message: message })

    // Refund credits
    const { data: current } = await supabase.from('credits').select('balance').eq('user_id', userId).single()
    await supabase.from('credits').update({ balance: (current?.balance ?? 0) + 30 }).eq('user_id', userId)
    await supabase.from('credit_transactions').insert({ user_id: userId, amount: 30, reason: 'refund', video_id: videoId })

    return { success: false, error: message }
  }
}
