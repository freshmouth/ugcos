import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resumeFromFalVideo } from '@/lib/pipeline/resume-from-fal'
import type { Project } from '@/lib/pipeline/types'

const FAL_CDN_BASE = 'https://fal.media/files'

type RequestBody = {
  videoId: string
  falFileId?: string
  falVideoUrl?: string
  hookText?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: RequestBody
  try {
    body = await request.json() as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { videoId, falFileId, hookText } = body
  const falVideoUrl = body.falVideoUrl ?? (falFileId ? `${FAL_CDN_BASE}/${falFileId}` : null)

  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  if (!falVideoUrl) return NextResponse.json({ error: 'falVideoUrl or falFileId required' }, { status: 400 })

  const { data: video } = await supabase
    .from('videos')
    .select('*, projects(*)')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()

  if (!video) return NextResponse.json({ error: 'video_not_found' }, { status: 404 })
  if (!video.projects) return NextResponse.json({ error: 'project_not_found' }, { status: 404 })

  const raw = video.projects as Record<string, unknown>

  const project: Project = {
    id: raw.id as string,
    user_id: raw.user_id as string,
    name: raw.name as string,
    product_description: (raw.product_description as string | null) ?? null,
    target_audience: (raw.target_audience as string | null) ?? null,
    product_category: (raw.product_category as string | null) ?? null,
    content_types: (raw.content_types as string[]) ?? [],
    posting_frequency: (raw.posting_frequency as string) ?? 'daily',
    posting_time: (raw.posting_time as string) ?? '09:00',
    metricool_brand_id: (raw.metricool_brand_id as string | null) ?? null,
    instagram_connected: (raw.instagram_connected as boolean) ?? false,
    facebook_connected: (raw.facebook_connected as boolean) ?? false,
    active: (raw.active as boolean) ?? true,
    autopilot: (raw.autopilot as boolean) ?? false,
    system_prompt: (raw.system_prompt as string | null) ?? null,
    script_prompts: (raw.script_prompts as string[]) ?? [],
    cloudinary_folder: (raw.cloudinary_folder as string | null) ?? null,
    character_reference_url: (raw.character_reference_url as string | null) ?? null,
    voice_reference_url: (raw.voice_reference_url as string | null) ?? null,
    hooks_library: (raw.hooks_library as string[]) ?? [],
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  }

  // Mark assembling immediately so the UI reflects progress
  await supabase.from('videos').update({
    status: 'assembling',
    error_message: null,
    fal_video_url: falVideoUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', videoId)

  // Fire async — stages 5-7 run in the background
  resumeFromFalVideo({
    project,
    userId: user.id,
    videoId,
    falVideoUrl,
    hookText,
  }).catch(console.error)

  return NextResponse.json({
    video_id: videoId,
    status: 'assembling',
    fal_video_url: falVideoUrl,
    message: 'Pipeline resumed. Stages 5-7 (Assembly → Captions → Publish) are running.',
  })
}
