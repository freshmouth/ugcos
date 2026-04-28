import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPipeline } from '@/lib/pipeline/run'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId } = await params

  const { data: video } = await supabase
    .from('videos')
    .select('*, projects(*)')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()

  if (!video) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (video.status !== 'failed') {
    return NextResponse.json({ error: 'only_failed_videos_can_be_retried' }, { status: 400 })
  }

  const project = video.projects
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 })

  // Reset video status
  await supabase.from('videos').update({ status: 'pending', error_message: null }).eq('id', videoId)

  runPipeline({
    project: {
      ...project,
      character_reference_url: project.character_reference_url ?? null,
      voice_reference_url: project.voice_reference_url ?? null,
      hooks_library: project.hooks_library ?? [],
    },
    userId: user.id,
    videoId,
    contentType: video.content_type ?? 'informative',
    triggeredBy: 'manual',
  }).catch(console.error)

  return NextResponse.json({ video_id: videoId, status: 'retrying' })
}
