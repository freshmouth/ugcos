import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import OpenAI from 'openai'

const MC_BASE = 'https://app.metricool.com'
const MC_USER_ID = process.env.METRICOOL_USER_ID ?? '4210220'

function mcHeaders() {
  return { 'X-Mc-Auth': process.env.METRICOOL_API_KEY ?? '', Accept: 'application/json' }
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.data)) return d.data
    if (Array.isArray(d.items)) return d.items
  }
  return []
}

type IGReel = {
  reelId?: string
  views?: number
  videoViews?: number
  impressionsTotal?: number
  likes?: number
  engagement?: number
  engagementRate?: number
  content?: string
  reach?: number
  publishedAt?: { dateTime?: string } | string
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toString()
}

export async function POST(req: NextRequest) {
  if (!process.env.METRICOOL_API_KEY) return NextResponse.json({ error: 'METRICOOL_API_KEY not set' }, { status: 500 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })

  // Parse body first (stream can only be consumed once)
  const body = await req.json() as { project_id: string; user_id?: string; days_back?: number }

  // Auth: user session OR cron secret
  const cronSecret = req.headers.get('x-cron-secret')
  const isCron = !!cronSecret && cronSecret === process.env.CRON_SECRET

  let userId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any

  if (isCron) {
    if (!body.user_id) return NextResponse.json({ error: 'user_id required for cron auth' }, { status: 400 })
    userId = body.user_id
    db = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
    db = supabase
  }

  const { project_id, days_back = 90 } = body

  // Fetch project to get its brand-specific blogId
  const { data: project } = isCron
    ? await db.from('projects').select('id, name, metricool_brand_id').eq('id', project_id).single()
    : await db.from('projects').select('id, name, metricool_brand_id').eq('id', project_id).eq('user_id', userId).single()

  if (!project?.metricool_brand_id) {
    return NextResponse.json({ error: 'Project has no Metricool brand linked' }, { status: 400 })
  }

  const blogId = project.metricool_brand_id as string
  const brandName = (project.name as string) ?? 'this brand'

  // Fetch user email to check owner bypass
  const OWNER_EMAIL = 'espeliers@live.com'
  let isOwner = false
  if (!isCron) {
    const { data: profile } = await db.from('profiles').select('email').eq('id', userId).single()
    isOwner = profile?.email === OWNER_EMAIL
  }

  // 24h rate limit — skipped for owner account
  if (!isOwner) {
    const { data: recent } = await db
      .from('insights')
      .select('*')
      .eq('project_id', project_id)
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent) return NextResponse.json({ cached: true, data: recent })
  }

  // Build ISO date range
  const now = new Date()
  const start = new Date(Date.now() - days_back * 86400000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const toISO = (d: Date, b: 'start' | 'end') => {
    const y = d.getFullYear(), m = pad(d.getMonth() + 1), day = pad(d.getDate())
    return b === 'start' ? `${y}-${m}-${day}T00:00:00` : `${y}-${m}-${day}T23:59:59`
  }
  const from = toISO(start, 'start'), to = toISO(now, 'end')
  const qs = `blogId=${blogId}&userId=${MC_USER_ID}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`

  const res = await fetch(`${MC_BASE}/api/v2/analytics/reels/instagram?${qs}`, { headers: mcHeaders() })
  if (!res.ok) return NextResponse.json({ error: `Metricool ${res.status}` }, { status: 502 })

  const raw = extractArray(await res.json()) as IGReel[]
  if (raw.length === 0) return NextResponse.json({ error: 'No reels found in this period' }, { status: 404 })

  // Score and rank
  const scored = raw.map(r => {
    const videoViews = r.videoViews ?? r.views ?? r.impressionsTotal ?? 0
    const engagement = r.engagementRate ?? r.engagement ?? 0
    return {
      ...r,
      videoViews,
      engagement,
      score: (videoViews * 0.5) + ((r.likes ?? 0) * 0.3) + (engagement * 1000 * 0.2),
      date: typeof r.publishedAt === 'string' ? r.publishedAt : (r.publishedAt as { dateTime?: string })?.dateTime ?? '',
      text: r.content ?? '',
    }
  }).sort((a, b) => b.score - a.score)

  const topReels = scored.slice(0, 5)
  const viralReels = scored.filter(r => r.videoViews >= 50000)
  const chartScores = topReels.map(r => Math.round(r.score))

  // Per-video breakdown section for viral videos
  const viralSection = viralReels.length > 0 ? `

VIRAL VIDEOS — Individual breakdown required (${viralReels.length} video${viralReels.length > 1 ? 's' : ''} with 50K+ views):
${viralReels.map((r, i) => `
VIDEO ${i + 1} — postId: ${r.reelId ?? 'unknown'}
Views: ${r.videoViews.toLocaleString()}  Likes: ${(r.likes ?? 0).toLocaleString()}  ER: ${r.engagement}%
Caption: "${r.text.slice(0, 200)}"
`).join('\n---\n')}` : ''

  const prompt = `Analyze these top performing Instagram Reels for ${brandName}:

${topReels.map((r, i) => `
REEL ${i + 1} — Score: ${r.score.toFixed(0)}
Views: ${r.videoViews.toLocaleString()}
Likes: ${(r.likes ?? 0).toLocaleString()}
Engagement: ${r.engagement}%
Reach: ${(r.reach ?? 0).toLocaleString()}
Published: ${r.date}
Caption: "${r.text}"
`).join('\n---\n')}
${viralSection}

Return this exact JSON:
{
  "top_hooks": [
    { "text": "exact opening line or hook from the caption", "avg_views": ${topReels[0]?.videoViews ?? 0}, "why_it_works": "brief explanation in Spanish why this hook stops the scroll" }
  ],
  "winning_phrases": [
    { "phrase": "specific phrase that appears in top performers", "frequency": 2, "context": "how it is used" }
  ],
  "content_patterns": [
    { "pattern": "what content pattern works best", "example": "quote or description from a top video", "avg_views": 350000 }
  ],
  "best_content_type": "shocking/informative/emotional/etc",
  "best_posting_time": "time extracted from top posts e.g. 5:00 PM",
  "ai_insight": "2-3 sentence actionable insight in Spanish about what drives views for this brand",
  "recommended_hook": "ready-to-use hook for next video in Spanish",
  "performance_summary": "brief summary in Spanish of what worked"${viralReels.length > 0 ? `,
  "video_breakdowns": [
    {
      "postId": "exact reelId from the viral video list above",
      "caption": "first 80 chars of caption",
      "views": 622913,
      "hook_analysis": "what made the hook work — in Spanish",
      "content_pattern": "content type pattern used — in Spanish",
      "audience_trigger": "emotion or response triggered — in Spanish",
      "virality_factors": ["factor 1", "factor 2", "factor 3"],
      "recommended_followup": "suggested next video hook building on this — in Spanish"
    }
  ]` : ',\n  "video_breakdowns": []'}
}`

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a viral content analyst for Latin American social media, specializing in health and food products. You are analyzing content for ${brandName}. Only analyze the provided posts for this specific brand. Output JSON only. Write all insights in Spanish.`,
      },
      { role: 'user', content: prompt },
    ],
  })

  let analysis: Record<string, unknown> = {}
  try { analysis = JSON.parse(completion.choices[0]?.message?.content ?? '{}') } catch { /* keep empty */ }

  const { data: inserted, error: insertError } = await db
    .from('insights')
    .insert({
      project_id,
      user_id: userId,
      period_start: start.toISOString().slice(0, 10),
      period_end: now.toISOString().slice(0, 10),
      posts_analyzed: scored.length,
      top_hooks: analysis.top_hooks ?? [],
      winning_phrases: analysis.winning_phrases ?? [],
      content_patterns: analysis.content_patterns ?? [],
      best_content_type: analysis.best_content_type ?? null,
      best_posting_time: analysis.best_posting_time ?? null,
      ai_insight: analysis.ai_insight ?? null,
      recommended_hook: analysis.recommended_hook ?? null,
      summary: analysis.performance_summary ?? null,
      raw_top_posts: topReels.map(r => ({
        reelId: r.reelId, views: fmtViews(r.videoViews), score: Math.round(r.score), text: r.text,
      })),
      chart_scores: chartScores,
      video_breakdowns: analysis.video_breakdowns ?? [],
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  return NextResponse.json({ cached: false, data: inserted })
}
