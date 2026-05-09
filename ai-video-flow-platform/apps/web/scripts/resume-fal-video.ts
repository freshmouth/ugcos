// Run: cd apps/web && npx tsx --env-file .env.local scripts/resume-fal-video.ts
import { createClient } from '@supabase/supabase-js'
import { resumeFromFalVideo } from '../lib/pipeline/resume-from-fal'
import type { Project } from '../lib/pipeline/types'

const FAL_FILE_ID = '019de0d9-7d54-7b42-a99a-6c6cfae3f3f8'
// Resolved from fal.queue.result('fal-ai/sora-2/image-to-video', { requestId: FAL_FILE_ID })
const FAL_VIDEO_URL = 'https://v3b.fal.media/files/b/0a986587/QbffvRZLLqfTCRk2pGfAt_Q7TL5an0.mp4'
const HOOK_TEXT = undefined // uses project hooks_library[0] or generic fallback

async function main() {
  console.log('=== Resume FAL Video — Stages 5-7 ===\n')
  console.log(`FAL file: ${FAL_FILE_ID}`)
  console.log(`FAL URL:  ${FAL_VIDEO_URL}\n`)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Validate required env vars
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ]
  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    console.error('❌ Missing env vars:', missing.join(', '))
    process.exit(1)
  }
  console.log('✓ Core env vars present')
  console.log(`  Submagic: ${process.env.SUBMAGIC_API_KEY ? '✓' : '⚠ not set (captions skipped)'}`)
  console.log(`  Metricool: ${process.env.METRICOOL_API_KEY ? '✓' : '⚠ not set (publish skipped)'}\n`)

  // ── 1. Find the stalled video row ──────────────────────────────────────
  // Try: video where fal_video_url matches the FAL ID
  let video: Record<string, unknown> | null = null

  const { data: byFalUrl } = await supabase
    .from('videos')
    .select('*, projects(*)')
    .like('fal_video_url', `%${FAL_FILE_ID}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (byFalUrl) {
    video = byFalUrl
    console.log(`✓ Found video by fal_video_url match: ${video.id}`)
  }

  // Fallback: most recent video in failed / generating_video state
  if (!video) {
    const STALLED = ['failed', 'generating_video', 'pending']
    const { data: stalled } = await supabase
      .from('videos')
      .select('*, projects(*)')
      .in('status', STALLED)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (stalled) {
      video = stalled
      console.log(`✓ Found stalled video (status: ${video.status}): ${video.id}`)
    }
  }

  // Last resort: create a fresh video row under the first project
  if (!video) {
    console.log('⚠ No stalled video found — creating a new row under the first project...')

    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .limit(1)
      .single()

    if (!project) {
      console.error('❌ No project found. Complete onboarding first.')
      process.exit(1)
    }

    const { data: newVideo, error: insertErr } = await supabase
      .from('videos')
      .insert({
        project_id: project.id,
        user_id: project.user_id,
        status: 'generating_video',
        content_type: 'viral',
        fal_video_url: FAL_VIDEO_URL,
      })
      .select('*, projects(*)')
      .single()

    if (insertErr || !newVideo) {
      console.error('❌ Failed to create video row:', insertErr?.message)
      process.exit(1)
    }

    video = newVideo
    console.log(`✓ Created video row: ${video.id}`)
  }

  const videoId = video.id as string
  const userId = video.user_id as string
  const rawProject = video.projects as Record<string, unknown>

  if (!rawProject) {
    console.error('❌ Video has no associated project')
    process.exit(1)
  }

  const project: Project = {
    id: rawProject.id as string,
    user_id: rawProject.user_id as string,
    name: rawProject.name as string,
    product_description: (rawProject.product_description as string | null) ?? null,
    target_audience: (rawProject.target_audience as string | null) ?? null,
    product_category: (rawProject.product_category as string | null) ?? null,
    content_types: (rawProject.content_types as string[]) ?? [],
    posting_frequency: (rawProject.posting_frequency as string) ?? 'daily',
    posting_time: (rawProject.posting_time as string) ?? '09:00',
    metricool_brand_id: (rawProject.metricool_brand_id as string | null) ?? null,
    instagram_connected: (rawProject.instagram_connected as boolean) ?? false,
    facebook_connected: (rawProject.facebook_connected as boolean) ?? false,
    active: (rawProject.active as boolean) ?? true,
    autopilot: (rawProject.autopilot as boolean) ?? false,
    system_prompt: (rawProject.system_prompt as string | null) ?? null,
    script_prompts: (rawProject.script_prompts as string[]) ?? [],
    cloudinary_folder: (rawProject.cloudinary_folder as string | null) ?? null,
    character_reference_url: (rawProject.character_reference_url as string | null) ?? null,
    voice_reference_url: (rawProject.voice_reference_url as string | null) ?? null,
    hooks_library: (rawProject.hooks_library as string[]) ?? [],
    created_at: rawProject.created_at as string,
    updated_at: rawProject.updated_at as string,
  }

  console.log(`\nProject: ${project.name} (${project.id})`)
  console.log(`Instagram: ${project.instagram_connected} | Facebook: ${project.facebook_connected}`)
  console.log(`Metricool brand ID: ${project.metricool_brand_id ?? '(not set)'}`)
  console.log(`\nVideo ID: ${videoId}`)
  console.log('Starting stages 5 → 6 → 7 ...\n')

  const start = Date.now()
  const result = await resumeFromFalVideo({
    project,
    userId,
    videoId,
    falVideoUrl: FAL_VIDEO_URL,
    hookText: HOOK_TEXT,
  })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log('\n=== Result ===')
  console.log('Success:', result.success)
  console.log('Time:', elapsed + 's')

  if (!result.success) {
    console.error('Error:', result.error)
  } else {
    console.log('Cloudinary URL:', result.cloudinary_url)
    console.log('Captioned URL:', result.captioned_url)
    console.log('Post IDs:', result.post_ids?.join(', ') || '(none — Metricool may not be configured)')
  }

  // Verify final DB state
  const { data: finalVideo } = await supabase
    .from('videos')
    .select('status, cloudinary_url, captioned_url, metricool_post_id, error_message')
    .eq('id', videoId)
    .single()

  if (finalVideo) {
    console.log('\n=== DB State ===')
    console.log('status:            ', finalVideo.status)
    console.log('cloudinary_url:    ', finalVideo.cloudinary_url ? '✓' : '✗ null')
    console.log('captioned_url:     ', finalVideo.captioned_url ? '✓' : '✗ null')
    console.log('metricool_post_id: ', finalVideo.metricool_post_id ?? '(none)')
    if (finalVideo.error_message) console.error('error_message:', finalVideo.error_message)
  }

  process.exit(result.success ? 0 : 1)
}

main().catch(err => {
  console.error('\n❌ Unhandled error:', err)
  process.exit(1)
})
