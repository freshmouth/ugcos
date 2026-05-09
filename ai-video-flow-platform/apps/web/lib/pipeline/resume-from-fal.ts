import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScenePlan, Project } from './types'
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

async function updateStatus(
  supabase: SupabaseClient,
  videoId: string,
  status: string,
  extra?: Record<string, unknown>
) {
  await supabase
    .from('videos')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', videoId)
}

export type ResumeFromFalOptions = {
  project: Project
  userId: string
  videoId: string
  falVideoUrl: string
  hookText?: string
}

export type ResumeResult = {
  success: boolean
  cloudinary_url?: string
  captioned_url?: string
  post_ids?: string[]
  error?: string
}

export async function resumeFromFalVideo(options: ResumeFromFalOptions): Promise<ResumeResult> {
  const { project, userId, videoId, falVideoUrl, hookText } = options
  const supabase = getServiceClient()
  const t0 = Date.now()

  const log = async (
    stage: number,
    name: string,
    status: 'started' | 'completed' | 'failed',
    extra?: Record<string, unknown>
  ) => {
    await insertPipelineLog(supabase, {
      video_id: videoId,
      stage,
      stage_name: name,
      status,
      duration_ms: status !== 'started' ? Date.now() - t0 : undefined,
      metadata: extra,
    })
  }

  // Single-scene ScenePlan stub pointing at the pre-generated FAL clip
  const resolvedHook = hookText ?? project.hooks_library?.[0] ?? 'Wait until the end...'
  const stubPlan: ScenePlan = {
    total_scenes: 1,
    target_duration_seconds: 16,
    avatar: {
      description: 'UGC Creator',
      outfit_casual: 'casual wear',
      outfit_athletic: 'athletic wear',
    },
    props: {
      continuity_prop: 'product',
      product_description: project.product_description ?? 'Product',
    },
    hook_text: resolvedHook,
    scenes: [
      {
        id: 1,
        type: 'talking_head',
        location: 'home kitchen',
        outfit: 'casual',
        duration_seconds: 16,
        camera: 'medium shot',
        action: 'talking to camera with product',
        background: 'neutral warm',
        show_product: true,
        motion: 'subtle handheld',
        caption: resolvedHook,
        clip_url: falVideoUrl,
      },
    ],
  }

  console.log(`[RESUME] ══════════════════════════════════════════`)
  console.log(`[RESUME] Resuming pipeline (stages 5-7) for video ${videoId}`)
  console.log(`[RESUME] FAL URL: ${falVideoUrl}`)
  console.log(`[RESUME] ══════════════════════════════════════════`)

  try {
    // ── Stage 5: Assembly ─────────────────────────────────────────────────
    console.log(`[RESUME] Stage 5: assembly`)
    await updateStatus(supabase, videoId, 'assembling', { fal_video_url: falVideoUrl })
    await log(5, 'assembly', 'started')
    const { cloudinary_url, duration_actual } = await stage05Assembly(stubPlan, videoId, project.id, userId)
    await updateStatus(supabase, videoId, 'assembling', { cloudinary_url })
    await log(5, 'assembly', 'completed', { cloudinary_url, duration_actual })
    console.log(`[RESUME] Stage 5 complete: ${cloudinary_url} (${duration_actual}s)`)

    // ── Stage 6: Captions ─────────────────────────────────────────────────
    console.log(`[RESUME] Stage 6: captions`)
    await updateStatus(supabase, videoId, 'captioning')
    await log(6, 'captions', 'started')
    const { captioned_url } = await stage06Captions(cloudinary_url, stubPlan, project.id, videoId, supabase)
    await updateStatus(supabase, videoId, 'captioning', { captioned_url })
    await log(6, 'captions', 'completed', { captioned_url })
    console.log(`[RESUME] Stage 6 complete: ${captioned_url}`)

    // ── Stage 7: Publish ──────────────────────────────────────────────────
    console.log(`[RESUME] Stage 7: publish`)
    await updateStatus(supabase, videoId, 'posting')
    await log(7, 'publish', 'started')
    const { post_ids } = await stage07Publish(project, captioned_url, stubPlan)
    const postIdStr = post_ids.join(',')
    await log(7, 'publish', 'completed', { post_ids })
    console.log(`[RESUME] Stage 7 complete: post_ids=${postIdStr || '(none)'}`)

    await updateStatus(supabase, videoId, 'done', {
      metricool_post_id: postIdStr || null,
    })

    // Increment subscription usage counter (best-effort)
    try {
      await supabase.rpc('increment_videos_used', { p_user_id: userId })
    } catch {
      // Non-blocking
    }

    await cleanupTmp(videoId)

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    console.log(`[RESUME] SUCCESS — video ${videoId} done in ${elapsed}s`)

    return { success: true, cloudinary_url, captioned_url, post_ids }
  } catch (err) {
    let message: string
    if (err instanceof Error) {
      message = err.message
    } else if (err && typeof err === 'object') {
      message = JSON.stringify(err)
    } else {
      message = String(err)
    }
    console.error(`[RESUME] FAILED at video ${videoId}:`, message)
    if (err instanceof Error && err.stack) console.error('[RESUME] Stack:', err.stack)
    await updateStatus(supabase, videoId, 'failed', { error_message: message })
    await cleanupTmp(videoId)
    return { success: false, error: message }
  }
}
