import { v2 as cloudinary } from 'cloudinary'
import type { ScenePlan } from '../types'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export type AssemblyResult = {
  cloudinary_url: string
  duration_actual: number
}

export async function stage05Assembly(
  plan: ScenePlan,
  videoId: string,
  projectId: string,
  userId: string
): Promise<AssemblyResult> {
  const tmpFolder = `catalog/${projectId}/tmp/${videoId}`
  const finalFolder = `catalog/${projectId}/videos`

  // Step 1: Upload all clips to Cloudinary in parallel with ordered public_ids
  const scenesWithClips = plan.scenes.filter((s): s is typeof s & { clip_url: string } => Boolean(s.clip_url))
  if (!scenesWithClips.length) throw new Error('No scenes have clips — assembly cannot proceed')
  const skipped = plan.scenes.length - scenesWithClips.length
  if (skipped > 0) console.log(`[PIPELINE] Stage 5: ${skipped} scene(s) skipped (no clip_url)`)
  console.log(`[PIPELINE] Stage 5: Uploading ${scenesWithClips.length} clips to Cloudinary...`)
  const uploadResults = await Promise.all(
    scenesWithClips.map(async (scene, i) => {
      const publicId = `${tmpFolder}/clip_${String(i).padStart(3, '0')}`
      const result = await cloudinary.uploader.upload(scene.clip_url, {
        resource_type: 'video',
        public_id: publicId,
        overwrite: true,
      })
      const audioMeta = (result as unknown as { audio?: { codec?: string; bit_rate?: string } }).audio
      const audioBitrate = parseInt(audioMeta?.bit_rate ?? '0')
      if (!audioMeta?.codec || audioBitrate < 1000) {
        throw new Error(`NO_AUDIO: scene ${i + 1} clip has no audible audio (codec: ${audioMeta?.codec ?? 'none'}, bitrate: ${audioBitrate}bps) — re-generation required`)
      }
      console.log(`[PIPELINE] Stage 5: Scene ${i + 1} audio OK (${audioMeta.codec}, ${Math.round(audioBitrate / 1000)}kbps)`)
      return {
        index: i,
        publicId: result.public_id,
        url: result.secure_url,
        duration: (result.duration as number | undefined) ?? scene.duration_seconds,
      }
    })
  )

  // Sort by index to guarantee correct order
  uploadResults.sort((a, b) => a.index - b.index)
  console.log(`[PIPELINE] Stage 5: All ${uploadResults.length} clips uploaded`)

  // Step 2: Concatenate using Cloudinary splice transformation
  const finalPublicId = `${finalFolder}/assembled_${videoId}`

  let cloudinaryUrl: string
  let durationActual: number

  if (uploadResults.length === 1) {
    // Single clip — just re-upload with final folder + tags
    const r = await cloudinary.uploader.upload(uploadResults[0]!.url, {
      resource_type: 'video',
      public_id: finalPublicId,
      overwrite: true,
      tags: [projectId, userId, 'assembled'],
    })
    cloudinaryUrl = r.secure_url
    durationActual = (r.duration as number | undefined) ?? plan.target_duration_seconds
  } else {
    // Build splice chain: each subsequent clip is appended to the base (clip_000)
    // Format: l_video:{publicId1}/fl_splice/l_video:{publicId2}/fl_splice
    const spliceStr = uploadResults.slice(1)
      .map(c => `l_video:${c.publicId.replace(/\//g, ':')}/fl_splice`)
      .join('/')

    console.log(`[PIPELINE] Stage 5: Concatenating via Cloudinary splice...`)
    console.log(`[PIPELINE] Stage 5: Splice transformation: ${spliceStr.slice(0, 120)}...`)

    // Upload base clip with eager splice transformation applied synchronously
    const assembled = await cloudinary.uploader.upload(uploadResults[0]!.url, {
      resource_type: 'video',
      public_id: finalPublicId,
      overwrite: true,
      eager: [{ raw_transformation: spliceStr }],
      eager_async: false,
      tags: [projectId, userId, 'assembled'],
    })

    // Prefer the eager-transformed URL (has all clips) over the raw upload URL
    const eagerResult = (assembled.eager as Array<{ secure_url: string; duration?: number }> | undefined)?.[0]
    cloudinaryUrl = eagerResult?.secure_url ?? assembled.secure_url
    durationActual = eagerResult?.duration ?? (assembled.duration as number | undefined) ?? plan.target_duration_seconds

    console.log(`[PIPELINE] Stage 5: Assembled URL: ${cloudinaryUrl}`)
  }

  return { cloudinary_url: cloudinaryUrl, duration_actual: durationActual }
}
