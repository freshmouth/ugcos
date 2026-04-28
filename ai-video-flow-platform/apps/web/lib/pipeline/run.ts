import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PipelineOptions, PipelineResult, ScenePlan } from './types'
import { stage01Comprehension } from './stages/01-comprehension'
import { stage02CreativeBrain } from './stages/02-creative-brain'
import { stage03ImageGeneration } from './stages/03-image-generation'
import { stage04VideoGeneration } from './stages/04-video-generation'
import { stage05Assembly } from './stages/05-assembly'
import { stage06Captions } from './stages/06-captions'
import { stage07Publish } from './stages/07-publish'
import { cleanupTmp } from './utils/cleanup'
import { insertPipelineLog } from '@/lib/db/pipeline-logs'

function getServiceClient(): SupabaseClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  ) as unknown as SupabaseClient
}

async function updateVideoStatus(
  supabase: SupabaseClient,
  videoId: string,
  status: string,
  extra?: Record<string, unknown>
) {
  await supabase.from('videos').update({ status, updated_at: new Date().toISOString(), ...extra }).eq('id', videoId)
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { project, userId, videoId, contentType, referenceVideoUrl } = options
  const supabase = getServiceClient()
  const t0 = Date.now()

  const log = async (stage: number, name: string, status: 'started' | 'completed' | 'failed', extra?: Record<string, unknown>) => {
    await insertPipelineLog(supabase, {
      video_id: videoId,
      stage,
      stage_name: name,
      status,
      duration_ms: status !== 'started' ? Date.now() - t0 : undefined,
      metadata: extra,
    })
  }

  try {
    // ── STAGE 1: Comprehension ─────────────────────────────────────────────
    await updateVideoStatus(supabase, videoId, 'analyzing')
    await log(1, 'comprehension', 'started')
    const brief = await stage01Comprehension(options, supabase)
    await log(1, 'comprehension', 'completed', { brief })

    // ── STAGE 2: Creative Brain ────────────────────────────────────────────
    await updateVideoStatus(supabase, videoId, 'scripting')
    await log(2, 'creative_brain', 'started')
    const scenePlan: ScenePlan = await stage02CreativeBrain(brief, project)
    await updateVideoStatus(supabase, videoId, 'scripting', { scene_plan: scenePlan })
    await log(2, 'creative_brain', 'completed', { total_scenes: scenePlan.total_scenes })

    // ── STAGE 3: Image Generation ──────────────────────────────────────────
    await updateVideoStatus(supabase, videoId, 'generating_images')
    await log(3, 'image_generation', 'started')
    const planWithImages = await stage03ImageGeneration(scenePlan, project, supabase)
    await log(3, 'image_generation', 'completed', { scenes_generated: planWithImages.scenes.length })

    // ── STAGE 4: Video Generation ──────────────────────────────────────────
    await updateVideoStatus(supabase, videoId, 'generating_video')
    await log(4, 'video_generation', 'started')
    const planWithClips = await stage04VideoGeneration(planWithImages)
    await log(4, 'video_generation', 'completed', { clips_generated: planWithClips.scenes.filter(s => s.clip_url).length })

    // ── STAGE 5: Assembly ──────────────────────────────────────────────────
    await updateVideoStatus(supabase, videoId, 'assembling')
    await log(5, 'assembly', 'started')
    const { cloudinary_url, duration_actual } = await stage05Assembly(planWithClips, videoId, project.id, userId)
    await updateVideoStatus(supabase, videoId, 'assembling', { cloudinary_url })
    await log(5, 'assembly', 'completed', { cloudinary_url, duration_actual })

    // ── STAGE 6: Captions ──────────────────────────────────────────────────
    await updateVideoStatus(supabase, videoId, 'captioning')
    await log(6, 'captions', 'started')
    const { captioned_url } = await stage06Captions(cloudinary_url, planWithClips, project.id)
    await updateVideoStatus(supabase, videoId, 'captioning', { captioned_url })
    await log(6, 'captions', 'completed', { captioned_url })

    // ── STAGE 7: Publish ───────────────────────────────────────────────────
    await updateVideoStatus(supabase, videoId, 'posting')
    await log(7, 'publish', 'started')
    const { post_ids } = await stage07Publish(project, captioned_url, planWithClips)
    const postIdStr = post_ids.join(',')
    await log(7, 'publish', 'completed', { post_ids })

    // ── Done ───────────────────────────────────────────────────────────────
    await updateVideoStatus(supabase, videoId, 'done', {
      metricool_post_id: postIdStr || null,
    })

    // Increment subscription usage counter (best-effort)
    try {
      await supabase.rpc('increment_videos_used', { p_user_id: userId })
    } catch {
      // Non-blocking; quota count failure does not fail the pipeline
    }

    await cleanupTmp(videoId)

    return { success: true, cloudinary_url, captioned_url, post_ids }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await updateVideoStatus(supabase, videoId, 'failed', { error_message: message })
    await cleanupTmp(videoId)
    return { success: false, error: message }
  }
}
