import { v2 as cloudinary } from 'cloudinary'
import type { ScenePlan } from '../types'
import { pollUntil } from '../utils/retry'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export type CaptionResult = {
  captioned_url: string
}

export async function stage06Captions(
  cloudinaryUrl: string,
  plan: ScenePlan,
  projectId: string
): Promise<CaptionResult> {
  if (!process.env.SUBMAGIC_API_KEY) {
    return { captioned_url: cloudinaryUrl }
  }

  const submittedId = await submitToSubmagic(cloudinaryUrl, plan.hook_text)
  const captionedVideoUrl = await pollUntil(
    () => pollSubmagicStatus(submittedId),
    10_000,
    300_000
  )

  // Re-upload captioned video to Cloudinary as final version
  const folder = `catalog/${projectId}/videos/captioned`
  const uploadResult = await cloudinary.uploader.upload(captionedVideoUrl, {
    resource_type: 'video',
    folder,
    tags: [projectId, 'captioned', 'final'],
  })

  return { captioned_url: uploadResult.secure_url }
}

async function submitToSubmagic(videoUrl: string, hookText: string): Promise<string> {
  const res = await fetch('https://api.submagic.co/captions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUBMAGIC_API_KEY}`,
    },
    body: JSON.stringify({
      video_url: videoUrl,
      style: 'hook_bold',
      hook_text: hookText,
      caption_style: {
        font_weight: 'bold',
        color: '#FFFFFF',
        animation: 'word_by_word',
        position: 'bottom_third',
      },
    }),
  })
  if (!res.ok) throw new Error(`Submagic submit error: ${res.status}`)
  const data = await res.json() as { id?: string; job_id?: string }
  const id = data.id ?? data.job_id
  if (!id) throw new Error('Submagic returned no job ID')
  return id
}

async function pollSubmagicStatus(jobId: string): Promise<string | null> {
  const res = await fetch(`https://api.submagic.co/captions/${jobId}`, {
    headers: { Authorization: `Bearer ${process.env.SUBMAGIC_API_KEY}` },
  })
  if (!res.ok) return null
  const data = await res.json() as {
    status?: string
    captioned_url?: string
    url?: string
    output_url?: string
  }
  if (data.status === 'completed' || data.status === 'done') {
    return data.captioned_url ?? data.url ?? data.output_url ?? null
  }
  if (data.status === 'failed') throw new Error('Submagic captioning failed')
  return null
}
