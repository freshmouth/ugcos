import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runPipeline } from '@/lib/pipeline/run'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, content_type_override, custom_prompt, image_id } = await request.json()

  // 1. Validate project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'project_not_found' }, { status: 403 })
  }

  // 2. Check credits
  const { data: credits } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single()

  if (!credits || credits.balance < 30) {
    return NextResponse.json({ error: 'insufficient_credits' }, { status: 402 })
  }

  const contentType = content_type_override || project.content_types?.[0] || 'informative'

  // 3. Deduct credits
  await supabase.from('credits').update({ balance: credits.balance - 30 }).eq('user_id', user.id)
  await supabase.from('credit_transactions').insert({
    user_id: user.id,
    amount: -30,
    reason: 'video_generated',
  })

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

  // 5. Run pipeline in background (fire and forget)
  runPipeline({
    project,
    userId: user.id,
    videoId: video.id,
    contentType,
    customPrompt: custom_prompt,
    imageId: image_id,
    triggeredBy: 'manual',
  }).catch(console.error)

  return NextResponse.json({ video_id: video.id })
}
