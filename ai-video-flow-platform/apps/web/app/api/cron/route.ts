import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { runPipeline } from '@/lib/pipeline/run'
import { isInPostingWindow } from '@/lib/utils/posting-time'

export async function GET(request: Request) {
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  const { data: projects } = await supabase
    .from('projects')
    .select('*, credits!inner(balance)')
    .eq('active', true)
    .eq('autopilot', true)
    .or('instagram_connected.eq.true,facebook_connected.eq.true')

  if (!projects || projects.length === 0) {
    return NextResponse.json({ processed: 0, skipped: 0, failed: 0 })
  }

  let processed = 0, skipped = 0, failed = 0
  const details: Array<{ project_id: string; result: string }> = []

  for (const project of projects) {
    const creditBalance = (project.credits as { balance: number })?.balance ?? 0

    // Check posting window
    if (!isInPostingWindow(project.posting_time)) {
      skipped++
      details.push({ project_id: project.id, result: 'skipped: outside posting window' })
      continue
    }

    // Check credits
    if (creditBalance < 30) {
      skipped++
      details.push({ project_id: project.id, result: 'skipped: insufficient credits' })

      // Check if we already sent an alert today
      const today = new Date().toISOString().split('T')[0]
      const { data: todayAlert } = await supabase
        .from('videos')
        .select('id')
        .eq('project_id', project.id)
        .eq('status', 'failed')
        .gte('created_at', `${today}T00:00:00`)
        .limit(1)
        .single()

      if (!todayAlert) {
        // Mark a failed video so we don't spam
        await supabase.from('videos').insert({
          project_id: project.id,
          user_id: project.user_id,
          status: 'failed',
          error_message: 'Autopilot skipped: insufficient credits',
          credits_used: 0,
        })
      }

      continue
    }

    // Select content type (rotate by day of year)
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
    const contentTypes = project.content_types ?? ['informative']
    const contentType = contentTypes[dayOfYear % contentTypes.length] || 'informative'

    // Deduct credits
    await supabase.from('credits').update({ balance: creditBalance - 30 }).eq('user_id', project.user_id)
    await supabase.from('credit_transactions').insert({
      user_id: project.user_id,
      amount: -30,
      reason: 'video_generated',
    })

    // Create video row
    const { data: video } = await supabase.from('videos').insert({
      project_id: project.id,
      user_id: project.user_id,
      status: 'pending',
      content_type: contentType,
    }).select().single()

    if (!video) {
      failed++
      details.push({ project_id: project.id, result: 'failed: could not create video row' })
      continue
    }

    const result = await runPipeline({
      project,
      userId: project.user_id,
      videoId: video.id,
      contentType,
      triggeredBy: 'cron',
    })

    if (result.success) {
      processed++
      details.push({ project_id: project.id, result: 'success' })
    } else {
      failed++
      details.push({ project_id: project.id, result: `failed: ${result.error}` })
    }
  }

  return NextResponse.json({ processed, skipped, failed, details })
}
