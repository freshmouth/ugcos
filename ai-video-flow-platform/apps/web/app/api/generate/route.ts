import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPipeline } from '@/lib/pipeline/run'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, content_type_override, custom_prompt, reference_video_url } = await request.json()

  // 1. Validate project ownership
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'project_not_found' }, { status: 403 })
  }

  // 2. Check active subscription and quota
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!subscription) {
    return NextResponse.json({ error: 'no_active_subscription' }, { status: 402 })
  }

  const quotas: Record<string, number> = { starter: 30, growth: 60, scale: Infinity }
  const limit = quotas[subscription.tier] ?? 30
  if (subscription.videos_used_this_cycle >= limit) {
    return NextResponse.json({
      error: 'quota_exceeded',
      videos_used: subscription.videos_used_this_cycle,
      limit,
    }, { status: 402 })
  }

  // 3. Daily limit — max 2 videos per user per UTC day
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const { count: todayCount } = await supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString())
    .neq('status', 'failed')

  if ((todayCount ?? 0) >= 2) {
    return NextResponse.json({ error: 'daily_limit_exceeded', limit: 2 }, { status: 429 })
  }

  const contentType = content_type_override || project.content_types?.[0] || 'informative'

  // 4. Create video row
  const { data: video } = await supabase
    .from('videos')
    .insert({
      project_id: project.id,
      user_id: user.id,
      status: 'pending',
      content_type: contentType,
    })
    .select()
    .single()

  if (!video) {
    return NextResponse.json({ error: 'Failed to create video row' }, { status: 500 })
  }

  // 4. Run pipeline in background (fire and forget)
  runPipeline({
    project: {
      ...project,
      character_reference_url: project.character_reference_url ?? null,
      voice_reference_url: project.voice_reference_url ?? null,
      hooks_library: project.hooks_library ?? [],
    },
    userId: user.id,
    videoId: video.id,
    contentType,
    customPrompt: custom_prompt,
    referenceVideoUrl: reference_video_url,
    triggeredBy: 'manual',
  }).catch(console.error)

  return NextResponse.json({ video_id: video.id })
}
