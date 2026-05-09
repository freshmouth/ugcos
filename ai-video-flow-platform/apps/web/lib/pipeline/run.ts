import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PipelineOptions, PipelineResult, ScenePlan } from './types'
import { stage01Comprehension } from './stages/01-comprehension'
import { stage02CreativeBrain } from './stages/02-creative-brain'
import { stage03ImageGeneration } from './stages/03-image-generation'
import { stage03bImageQA } from './stages/03b-image-qa'
import { stage04VideoGeneration } from './stages/04-video-generation'
import { stage04bVideoQA } from './stages/04b-video-qa'
import { stage05Assembly } from './stages/05-assembly'
import { stage06Captions } from './stages/06-captions'
import { stage07Publish } from './stages/07-publish'
import { cleanupTmp } from './utils/cleanup'
import { insertPipelineLog } from '../db/pipeline-logs'

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

  console.log(`[PIPELINE] ══════════════════════════════════════════`)
  console.log(`[PIPELINE] Starting pipeline for video ${videoId}`)
  console.log(`[PIPELINE] Project: ${project.name} | Content type: ${contentType}`)
  console.log(`[PIPELINE] ══════════════════════════════════════════`)

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
    console.log(`[PIPELINE] Starting stage 1: comprehension`)
    await updateVideoStatus(supabase, videoId, 'analyzing')
    await log(1, 'comprehension', 'started')
    const brief = await stage01Comprehension(options, supabase)
    await log(1, 'comprehension', 'completed', { brief })
    console.log(`[PIPELINE] Stage 1 complete: hook_type=${brief.hook_type} pacing=${brief.pacing}`)

    // ── STAGE 2: Creative Brain ────────────────────────────────────────────
    console.log(`[PIPELINE] Starting stage 2: creative_brain`)
    await updateVideoStatus(supabase, videoId, 'scripting')
    await log(2, 'creative_brain', 'started')
    const scenePlan: ScenePlan = await stage02CreativeBrain(brief, project)
    await updateVideoStatus(supabase, videoId, 'scripting', { scene_plan: scenePlan })
    await log(2, 'creative_brain', 'completed', { total_scenes: scenePlan.total_scenes })
    console.log(`[PIPELINE] Stage 2 complete: ${scenePlan.total_scenes} scenes planned, hook="${scenePlan.hook_text}"`)

    // ── STAGE 3: Image Generation ──────────────────────────────────────────
    console.log(`[PIPELINE] Starting stage 3: image_generation (${scenePlan.scenes.length} scenes)`)
    await updateVideoStatus(supabase, videoId, 'generating_images')
    await log(3, 'image_generation', 'started')
    const planWithImages = await stage03ImageGeneration(scenePlan, project, supabase, videoId)
    await log(3, 'image_generation', 'completed', { scenes_generated: planWithImages.scenes.length })
    console.log(`[PIPELINE] Stage 3 complete: ${planWithImages.scenes.filter(s => s.image_url).length}/${planWithImages.scenes.length} images generated`)

    // ── STAGE 3b: Image QA ─────────────────────────────────────────────────
    console.log(`[PIPELINE] Starting stage 3b: image_qa`)
    await log(3, 'image_qa', 'started')
    const planWithImagesQA = await stage03bImageQA(planWithImages, project, supabase, videoId)
    await log(3, 'image_qa', 'completed')
    console.log(`[PIPELINE] Stage 3b complete`)

    // ── STAGES 4 + 5: Video gen + Assembly (auto-retry on missing audio) ────
    let planWithClips!: ScenePlan
    let cloudinary_url!: string
    let duration_actual!: number
    const MAX_VIDEO_RETRIES = 2

    for (let attempt = 1; attempt <= MAX_VIDEO_RETRIES; attempt++) {
      if (attempt > 1) console.log(`[PIPELINE] Re-generating video — attempt ${attempt}/${MAX_VIDEO_RETRIES} (no audio detected)`)

      console.log(`[PIPELINE] Starting stage 4: video_generation`)
      await updateVideoStatus(supabase, videoId, 'generating_video')
      await log(4, 'video_generation', 'started')
      planWithClips = await stage04VideoGeneration(planWithImagesQA, contentType, project, { forceAudio: attempt > 1 })
      await log(4, 'video_generation', 'completed', { clips_generated: planWithClips.scenes.filter(s => s.clip_url).length })
      console.log(`[PIPELINE] Stage 4 complete: ${planWithClips.scenes.filter(s => s.clip_url).length}/${planWithClips.scenes.length} clips generated`)

      console.log(`[PIPELINE] Starting stage 5: assembly`)
      await updateVideoStatus(supabase, videoId, 'assembling')
      await log(5, 'assembly', 'started')
      try {
        const assembled = await stage05Assembly(planWithClips, videoId, project.id, userId)
        cloudinary_url = assembled.cloudinary_url
        duration_actual = assembled.duration_actual
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.startsWith('NO_AUDIO') && attempt < MAX_VIDEO_RETRIES) {
          console.warn(`[PIPELINE] ${msg} — re-generating video`)
          continue
        }
        throw err
      }

      await updateVideoStatus(supabase, videoId, 'assembling', { cloudinary_url })
      await log(5, 'assembly', 'completed', { cloudinary_url, duration_actual })
      console.log(`[PIPELINE] Stage 5 complete: ${cloudinary_url} (${duration_actual}s)`)

      // ── STAGE 4b: Video QA ───────────────────────────────────────────────
      console.log(`[PIPELINE] Starting stage 4b: video_qa`)
      try {
        const { qa_score: videoQaScore } = await stage04bVideoQA(cloudinary_url, videoId, supabase)
        console.log(`[QA] Video score: ${videoQaScore}/10 PASS`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.startsWith('VIDEO_QA_FAIL:') && attempt < MAX_VIDEO_RETRIES) {
          console.warn(`[PIPELINE] ${msg} — re-generating video`)
          continue
        }
        if (msg.startsWith('VIDEO_QA_FAIL:')) {
          console.warn('[PIPELINE] Video QA failed after retry — continuing with warning')
          await supabase.from('videos').update({ qa_warning: msg.replace('VIDEO_QA_FAIL: ', '') }).eq('id', videoId)
        } else {
          throw err
        }
      }

      break
    }

    // ── STAGE 6: Captions ──────────────────────────────────────────────────
    console.log(`[PIPELINE] Starting stage 6: captions`)
    await updateVideoStatus(supabase, videoId, 'captioning')
    await log(6, 'captions', 'started')
    const { captioned_url } = await stage06Captions(cloudinary_url, planWithClips, project.id, videoId, supabase)
    await updateVideoStatus(supabase, videoId, 'captioning', { captioned_url })
    await log(6, 'captions', 'completed', { captioned_url })
    console.log(`[PIPELINE] Stage 6 complete: ${captioned_url}`)

    // ── STAGE 7: Publish ───────────────────────────────────────────────────
    console.log(`[PIPELINE] Starting stage 7: publish`)
    await updateVideoStatus(supabase, videoId, 'posting')
    await log(7, 'publish', 'started')
    const { post_ids } = await stage07Publish(project, captioned_url, planWithClips)
    const postIdStr = post_ids.join(',')
    await log(7, 'publish', 'completed', { post_ids })
    console.log(`[PIPELINE] Stage 7 complete: post_ids=${postIdStr || '(none)'}`)

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

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[PIPELINE] ══════════════════════════════════════════`)
    console.log(`[PIPELINE] SUCCESS — video ${videoId} done in ${elapsed}s`)
    console.log(`[PIPELINE] ══════════════════════════════════════════`)

    return { success: true, cloudinary_url, captioned_url, post_ids }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : ''
    console.error(`[PIPELINE] FAILED at video ${videoId}:`, message)
    if (stack) console.error('[PIPELINE] Stack:', stack)
    await updateVideoStatus(supabase, videoId, 'failed', { error_message: message })
    await cleanupTmp(videoId)
    return { success: false, error: message }
  }
}
