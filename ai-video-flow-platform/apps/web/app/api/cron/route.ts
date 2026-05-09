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
    .select('*')
    .eq('active', true)
    .eq('autopilot', true)
    .or('instagram_connected.eq.true,facebook_connected.eq.true')

  if (!projects || projects.length === 0) {
    return NextResponse.json({ processed: 0, skipped: 0, failed: 0 })
  }

  let processed = 0, skipped = 0, failed = 0
  const details: Array<{ project_id: string; result: string }> = []

  const TIER_QUOTAS: Record<string, number> = { starter: 30, growth: 60, scale: Infinity }

  for (const project of projects) {
    if (!isInPostingWindow(project.posting_time)) {
      skipped++
      details.push({ project_id: project.id, result: 'skipped: outside posting window' })
      continue
    }

    // Check subscription quota
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, videos_used_this_cycle, status')
      .eq('user_id', project.user_id)
      .eq('status', 'active')
      .maybeSingle()

    if (!subscription) {
      skipped++
      details.push({ project_id: project.id, result: 'skipped: no active subscription' })
      continue
    }

    const quota = TIER_QUOTAS[subscription.tier] ?? 30
    if (subscription.videos_used_this_cycle >= quota) {
      skipped++
      details.push({ project_id: project.id, result: 'skipped: monthly quota reached' })
      continue
    }

    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const { count: todayCount } = await supabase
      .from('videos')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .gte('created_at', todayStart.toISOString())
      .neq('status', 'failed')

    if ((todayCount ?? 0) >= 1) {
      skipped++
      details.push({ project_id: project.id, result: 'skipped: daily limit of 1 reached' })
      continue
    }

    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
    const contentTypes = project.content_types ?? ['informative']
    const contentType = contentTypes[dayOfYear % contentTypes.length] || 'informative'

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

  // Auto-trigger insights analysis for projects with 50K+ viral videos not yet analyzed today
  const analysisResults: Array<{ project_id: string; result: string }> = []
  if (process.env.METRICOOL_API_KEY && process.env.OPENAI_API_KEY) {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const MC_USER_ID = process.env.METRICOOL_USER_ID ?? '4210220'
    const pad = (n: number) => String(n).padStart(2, '0')
    const now = new Date()
    const start90 = new Date(Date.now() - 90 * 86400000)
    const from = `${start90.getFullYear()}-${pad(start90.getMonth() + 1)}-${pad(start90.getDate())}T00:00:00`
    const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T23:59:59`

    for (const project of projects) {
      if (!project.metricool_brand_id) continue

      try {
        // Fetch reels for this project to check viral count
        const qs = `blogId=${project.metricool_brand_id}&userId=${MC_USER_ID}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        const reelsRes = await fetch(`https://app.metricool.com/api/v2/analytics/reels/instagram?${qs}`, {
          headers: { 'X-Mc-Auth': process.env.METRICOOL_API_KEY!, Accept: 'application/json' },
        })
        if (!reelsRes.ok) continue

        const reelsJson = await reelsRes.json()
        const reels = (Array.isArray(reelsJson) ? reelsJson : (reelsJson?.data ?? reelsJson?.items ?? [])) as Array<{
          reelId?: string; views?: number; videoViews?: number; impressionsTotal?: number
        }>

        const viralCount = reels.filter(r => (r.videoViews ?? r.views ?? r.impressionsTotal ?? 0) >= 50000).length
        if (viralCount === 0) continue

        // Check if analysis was done in the last 24h
        const { data: recentInsight } = await supabase
          .from('insights')
          .select('id')
          .eq('project_id', project.id)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle()

        if (recentInsight) {
          analysisResults.push({ project_id: project.id, result: 'skipped: analyzed recently' })
          continue
        }

        console.log(`[CRON] Found ${viralCount} viral videos (50K+) for project ${project.id}. Triggering analysis.`)

        // Trigger analysis via internal API call
        const analyzeRes = await fetch(`${baseUrl}/api/insights/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': process.env.CRON_SECRET ?? '',
          },
          body: JSON.stringify({
            project_id: project.id,
            user_id: project.user_id,
            days_back: 90,
          }),
        })

        const analyzeJson = await analyzeRes.json().catch(() => ({}))
        if (analyzeRes.ok) {
          analysisResults.push({ project_id: project.id, result: analyzeJson.cached ? 'cached' : 'analyzed' })
        } else {
          analysisResults.push({ project_id: project.id, result: `analysis failed: ${analyzeJson.error ?? analyzeRes.status}` })
        }
      } catch (err) {
        analysisResults.push({ project_id: project.id, result: `analysis error: ${String(err)}` })
      }
    }
  }

  return NextResponse.json({ processed, skipped, failed, details, analysisResults })
}
