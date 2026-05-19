import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runPipeline } from '@/lib/pipeline/run'

const CANELA_PROJECT_ID = '98a9cb9b-ac57-4d04-bd03-6bcb0e13a4c1'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const cronSecret = request.headers.get('x-cron-secret')
  const validBearer = auth === `Bearer ${process.env.CRON_SECRET}`
  const validHeader = cronSecret === process.env.CRON_SECRET

  if (!validBearer && !validHeader) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', CANELA_PROJECT_ID)
    .single()

  if (pErr || !project) {
    return NextResponse.json({ error: 'project not found' }, { status: 404 })
  }

  const { data: video, error: vErr } = await supabase
    .from('videos')
    .insert({
      project_id: project.id,
      user_id: project.user_id,
      status: 'pending',
      content_type: 'scroll_stopper',
    })
    .select()
    .single()

  if (vErr || !video) {
    return NextResponse.json({ error: 'failed to create video row' }, { status: 500 })
  }

  const result = await runPipeline({
    project: {
      ...project,
      character_reference_url: project.character_reference_url ?? null,
      voice_reference_url: project.voice_reference_url ?? null,
      hooks_library: project.hooks_library ?? [],
    },
    userId: project.user_id,
    videoId: video.id,
    contentType: 'scroll_stopper',
    triggeredBy: 'cron',
  })

  return NextResponse.json({
    success: result.success,
    video_id: video.id,
    cloudinary_url: result.cloudinary_url ?? null,
    post_ids: result.post_ids ?? [],
    error: result.error ?? null,
  }, { status: result.success ? 200 : 500 })
}
