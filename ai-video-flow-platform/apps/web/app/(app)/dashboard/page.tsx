import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AgentStatusWidget } from '@/components/app/agent-status-widget'
import { StatCard } from '@/components/app/stat-card'
import { ScheduleWidget, type ScheduleItem } from '@/components/app/schedule-widget'
import { ReelThumbCard, type ReelData } from '@/components/app/reel-thumb-card'
import { VideoThumbCard } from '@/components/app/video-thumb-card'
import { HookCard } from '@/components/app/hook-card'
import { InsightsCard } from '@/components/app/insights-card'
import { InsightsAnalyzeButton } from '@/components/app/insights-analyze-button'
import { BrandSwitcher } from '@/components/app/brand-switcher'
import { TimeframeSelector, type Timeframe } from '@/components/app/timeframe-selector'

// ─── Metricool helpers ───────────────────────────────────────────────────────

const MC_BASE = 'https://app.metricool.com'
const MC_USER_ID = process.env.METRICOOL_USER_ID ?? '4210220'

function mcHeaders() {
  return { 'X-Mc-Auth': process.env.METRICOOL_API_KEY ?? '', Accept: 'application/json' }
}

function toYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

// ISO datetime format required by reels/instagram and scheduler/posts endpoints
function toIsoDatetime(d: Date, boundary: 'start' | 'end' = 'start') {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return boundary === 'start' ? `${y}-${m}-${day}T00:00:00` : `${y}-${m}-${day}T23:59:59`
}

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.posts)) return d.posts
    if (Array.isArray(d.data)) return d.data
    if (Array.isArray(d.items)) return d.items
  }
  return []
}

async function mcFetch(url: string, label: string): Promise<unknown[]> {
  try {
    const res = await fetch(url, { headers: mcHeaders(), next: { revalidate: 300 } })
    const text = await res.text()
    console.log(`[mc:${label}] → ${res.status} | ${text.slice(0, 200)}`)
    if (!res.ok) return []
    return extractArray(JSON.parse(text))
  } catch (e) {
    console.error(`[mc:${label}] error:`, e)
    return []
  }
}

// ─── Date ranges ─────────────────────────────────────────────────────────────

function getDateRanges(tf: Timeframe) {
  const days = tf === '7d' ? 7 : tf === '30d' ? 30 : 365
  const end = new Date()
  const start = new Date(Date.now() - days * 86400000)

  return {
    // YYYYMMDD — used by stats/posts
    startDate: toYYYYMMDD(start),
    endDate: toYYYYMMDD(end),
    // ISO datetime — used by reels/instagram
    startIso: toIsoDatetime(start, 'start'),
    endIso: toIsoDatetime(end, 'end'),
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

// Shared normalised reel shape (covers both IG and FB reels after mapping)
type ReelItem = {
  reelId?: string
  views?: number           // IG: views field | FB: blueReelsPlayCount
  impressionsTotal?: number
  reach?: number
  engagement?: number      // already a % (e.g. 3.09)
  engagementRate?: number
  er?: number
  content?: string         // IG: content | FB: description
  publishedAt?: { dateTime?: string; timezone?: string } | string
  imageUrl?: string        // IG: imageUrl (Instagram CDN) | FB: thumbnailUrl (Metricool CDN, no 403)
  durationSeconds?: number // IG: durationSeconds | FB: Math.round(length)
  likes?: number           // IG: likes | FB: postVideoReactions
  url?: string
  link?: string | null     // post URL for click-through
  platform?: 'instagram' | 'facebook'
}

// v2/analytics/reels/facebook raw response (confirmed from diagnosis)
type FBReelRaw = {
  reelId?: string
  blueReelsPlayCount?: number   // play count for FB reels
  thumbnailUrl?: string          // Metricool CDN — reliable, no 403 cross-domain
  description?: string
  length?: number                // duration seconds (float)
  engagement?: number
  postVideoReactions?: number
  created?: { dateTime?: string; timezone?: string }
  reelUrl?: string
}

// stats/facebook/posts response (regular link/photo/non-reel posts)
type FBPostItem = {
  postId?: string
  picture?: string
  text?: string
  type?: string
  videoViews?: number
  impressions?: number
  reactions?: number
  engagement?: number
  created?: number        // milliseconds
  timestamp?: number
  permalinkUrl?: string
}

function reelPublishedAt(reel: ReelItem): Date | null {
  const pa = reel.publishedAt
  const dtStr = typeof pa === 'string' ? pa : pa?.dateTime ?? ''
  if (!dtStr) return null
  const d = new Date(dtStr)
  return isNaN(d.getTime()) ? null : d
}

// Fetches IG reels + FB reels + FB posts in parallel, normalises to ReelItem shape.
// Views = IG plays (views) + FB reel plays (blueReelsPlayCount) + FB post plays (videoViews).
async function fetchReelsAnalytics(blogId: string, startIso: string, endIso: string, startDate: string, endDate: string) {
  const isoQS = `blogId=${blogId}&userId=${MC_USER_ID}&from=${encodeURIComponent(startIso)}&to=${encodeURIComponent(endIso)}`
  const ymdQS = `blogId=${blogId}&userId=${MC_USER_ID}&start=${startDate}&end=${endDate}`

  const [igReels, fbReelsRaw, fbPosts] = await Promise.all([
    mcFetch(`${MC_BASE}/api/v2/analytics/reels/instagram?${isoQS}`, `ig-reels ${blogId}`) as Promise<ReelItem[]>,
    mcFetch(`${MC_BASE}/api/v2/analytics/reels/facebook?${isoQS}`,  `fb-reels ${blogId}`) as Promise<FBReelRaw[]>,
    mcFetch(`${MC_BASE}/api/stats/facebook/posts?${ymdQS}`,          `fb-posts ${blogId}`) as Promise<FBPostItem[]>,
  ])

  // Normalise FB reels → ReelItem; thumbnailUrl is Metricool CDN (no 403)
  const fbReels: ReelItem[] = (fbReelsRaw as FBReelRaw[]).map(r => ({
    reelId: r.reelId,
    views: r.blueReelsPlayCount,
    imageUrl: r.thumbnailUrl,
    content: r.description,
    durationSeconds: r.length != null ? Math.round(r.length) : undefined,
    engagement: r.engagement,
    likes: r.postVideoReactions,
    publishedAt: r.created,
    platform: 'facebook' as const,
    link: r.reelUrl ?? null,
  }))

  const igTagged: ReelItem[] = (igReels as ReelItem[]).map(r => ({ ...r, platform: 'instagram' as const }))

  const igViews      = igTagged.reduce((s, r) => s + (r.views ?? r.impressionsTotal ?? 0), 0)
  const fbReelViews  = fbReels.reduce((s, r) => s + (r.views ?? 0), 0)
  const fbPostViews  = (fbPosts as FBPostItem[]).reduce((s, p) => s + (p.videoViews ?? 0), 0)

  const allReels = [...igTagged, ...fbReels]
  const avgER = allReels.length > 0
    ? allReels.reduce((s, r) => s + (r.engagement ?? r.engagementRate ?? r.er ?? 0), 0) / allReels.length
    : 0

  return {
    views: igViews + fbReelViews + fbPostViews,
    engagementRate: Math.round(avgER * 100) / 100,
    reels: allReels,
  }
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export type MetricoolPostItem = {
  postId?: string; id?: string; text?: string; picture?: string; thumbnail?: string
  scheduledAt?: string; publishDate?: string; date?: string
  networks?: string[]; socialNetworks?: string[]; network?: string
  status?: string; state?: string; impressions?: number; likes?: number; engagementRate?: number
}

// ─── Schedule — last 30d published + next 30d scheduled ──────────────────────

function relativeDay(d: Date): string {
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const diffDays = Math.round((d.getTime() - todayMidnight.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  if (diffDays < 0 && diffDays > -7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function parsePost(p: MetricoolPostItem, brandName: string, forcedStatus?: ScheduleItem['status']): ScheduleItem | null {
  const rawDate = p.scheduledAt ?? p.publishDate ?? p.date
  if (!rawDate) return null
  const d = new Date(rawDate)
  if (isNaN(d.getTime())) return null

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const dayLabel = relativeDay(d)
  const rawNets: string[] = p.networks ?? p.socialNetworks ?? (p.network ? [p.network] : [])
  const isIG = rawNets.some(n => n.toLowerCase().includes('instagram'))
  const platform: ScheduleItem['platform'] = isIG ? 'instagram' : 'facebook'
  const rawStatus = (p.status ?? p.state ?? '').toLowerCase()
  const status: ScheduleItem['status'] = forcedStatus ?? (
    rawStatus === 'published' || rawStatus === 'sent' || rawStatus === 'done' ? 'posted'
    : rawStatus === 'publishing' || rawStatus === 'processing' ? 'progress'
    : 'upcoming'
  )
  return { time, dayLabel, platform, label: brandName || (isIG ? 'Instagram Reel' : 'Facebook Video'), status }
}

async function fetchSchedule(blogId: string, brandName: string): Promise<ScheduleItem[]> {
  const now = new Date()
  const nowIso = toIsoDatetime(now, 'start')
  const thirtyOutIso = toIsoDatetime(new Date(Date.now() + 30 * 86400000), 'end')

  // stats/posts always returns empty — only fetch upcoming scheduled posts
  const scheduledRaw = await mcFetch(
    `${MC_BASE}/api/v2/scheduler/posts?blogId=${blogId}&userId=${MC_USER_ID}&start=${encodeURIComponent(nowIso)}&end=${encodeURIComponent(thirtyOutIso)}`,
    `sched-upcoming blogId=${blogId}`
  )

  return (scheduledRaw as MetricoolPostItem[])
    .filter(p => {
      const st = (p.status ?? p.state ?? '').toLowerCase()
      return st !== 'published' && st !== 'sent' && st !== 'done'
    })
    .map(p => parsePost(p, brandName))
    .filter(Boolean) as ScheduleItem[]
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; timeframe?: string }>
}) {
  const { brand: selectedBrandId, timeframe: tfParam } = await searchParams
  const timeframe: Timeframe = tfParam === '30d' ? '30d' : tfParam === 'all' ? 'all' : '7d'
  const { startDate, endDate, startIso, endIso } = getDateRanges(timeframe)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    totalCreatedResult,
    totalPostedResult,
    recentVideosResult,
    subscriptionResult,
    profileResult,
    topHookResult,
    insightResult,
    activeBrandsResult,
  ] = await Promise.all([
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'done'),
    supabase.from('videos').select('id, status, content_type, captioned_url, cloudinary_url, fal_image_url, created_at, scene_plan').eq('user_id', user.id).eq('status', 'done').order('created_at', { ascending: false }).limit(5),
    supabase.from('subscriptions').select('tier, videos_used_this_cycle, cycle_reset_date').eq('user_id', user.id).eq('status', 'active').single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('videos').select('script_prompt').eq('user_id', user.id).eq('status', 'done').not('script_prompt', 'is', null),
    supabase.from('ai_insights').select('insight').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('projects').select('id, name, metricool_brand_id, metricool_blog_name').eq('user_id', user.id).eq('active', true).not('metricool_brand_id', 'is', null),
  ])

  const activeBrands = (activeBrandsResult.data ?? []).map(p => ({
    id: p.id as string,
    name: (p.metricool_blog_name ?? p.name) as string,
    blogId: p.metricool_brand_id as string,
  }))

  const activeProjectId = selectedBrandId || activeBrands[0]?.id || null

  // Structured AI insights scoped to the active brand
  const structuredInsightResult = activeProjectId
    ? await supabase.from('insights').select('top_hooks, ai_insight, recommended_hook, posts_analyzed, chart_scores, project_id, created_at').eq('user_id', user.id).eq('project_id', activeProjectId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null }

  const brandsToFetch = selectedBrandId
    ? activeBrands.filter(b => b.id === selectedBrandId)
    : activeBrands.length > 0
      ? activeBrands
      : process.env.METRICOOL_BLOG_ID
        ? [{ id: 'default', name: 'My Brand', blogId: process.env.METRICOOL_BLOG_ID }]
        : []

  // Fetch all Metricool data in parallel — pass ISO format to reels endpoint
  const [reelsResults, scheduleResults] = await Promise.all([
    Promise.all(brandsToFetch.map(b => fetchReelsAnalytics(b.blogId, startIso, endIso, startDate, endDate))),
    Promise.all(brandsToFetch.map(b => fetchSchedule(b.blogId, b.name))),
  ])

  // Aggregate reels
  const totalViews = reelsResults.reduce((sum, r) => sum + r.views, 0)
  const avgEngagement = reelsResults.length > 0
    ? reelsResults.reduce((sum, r) => sum + r.engagementRate, 0) / reelsResults.length
    : 0

  const scheduleItems = scheduleResults.flat()

  // FIX 2: When no schedule items, show last 5 published reels as "Recent Posts"
  // Sort all reels newest-first across brands, take top 5
  const allReels = reelsResults.flatMap(r => r.reels).sort((a, b) => {
    const da = reelPublishedAt(a)?.getTime() ?? 0
    const db = reelPublishedAt(b)?.getTime() ?? 0
    return db - da
  })
  const reelScheduleItems: ScheduleItem[] = allReels.slice(0, 5).map(reel => {
    const d = reelPublishedAt(reel) ?? new Date()
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    const dayLabel = relativeDay(d)
    const fallbackLabel = reel.platform === 'facebook' ? 'Facebook Reel' : 'Instagram Reel'
    const label = reel.content ? reel.content.replace(/\n.*/s, '').trim().slice(0, 40) : fallbackLabel
    return { time, dayLabel, platform: reel.platform ?? 'instagram', label, status: 'posted' as const }
  })

  // Supabase done videos (fallback when no Metricool reels)
  const recentVideos = (recentVideosResult.data ?? []).map(v => ({
    ...v,
    hook_text: v.scene_plan ? (v.scene_plan as { hook_text?: string }).hook_text ?? null : null,
  }))

  const totalCreated = totalCreatedResult.count ?? 0
  const totalPosted = totalPostedResult.count ?? 0
  const subscription = subscriptionResult.data
  const profile = profileResult.data
  const userName = profile?.full_name ?? user.email?.split('@')[0] ?? 'User'

  // Top hook
  const hookScripts = (topHookResult.data ?? []).map(v => v.script_prompt).filter(Boolean) as string[]
  const hookCounts: Record<string, number> = {}
  for (const s of hookScripts) hookCounts[s] = (hookCounts[s] ?? 0) + 1
  const topHookEntry = Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0]
  const topHookText = topHookEntry?.[0] ?? null
  const topHookCount = topHookEntry?.[1] ?? 0

  const latestInsight = insightResult.data?.insight ?? null

  // Structured insights from the AI insights engine
  type TopHook = { text: string; avg_views: number; why_it_works: string }
  const latestInsights = structuredInsightResult.data as {
    top_hooks: TopHook[] | null
    ai_insight: string | null
    recommended_hook: string | null
    posts_analyzed: number | null
    chart_scores: number[] | null
    project_id: string | null
    created_at: string
  } | null
  const tierQuotas: Record<string, number> = { starter: 30, growth: 60, scale: 999 }
  const quota = tierQuotas[subscription?.tier ?? 'starter'] ?? 30
  const used = subscription?.videos_used_this_cycle ?? 0
  const usagePercent = Math.min((used / quota) * 100, 100)

  const resetDate = subscription?.cycle_reset_date ? new Date(subscription.cycle_reset_date) : null
  const daysUntilReset = resetDate ? Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / 86400000)) : null

  const tfLabel = timeframe === '7d' ? 'last 7 days' : timeframe === '30d' ? 'last 30 days' : 'all time'

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', WebkitFontSmoothing: 'antialiased' }}>

      {/* ── Topbar ── */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between"
        style={{
          padding: '0 28px',
          background: 'rgba(12,12,15,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          height: '64px',
        }}
      >
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.5px] leading-tight">Dashboard</h1>
          <p className="text-[12px] mt-[1px]" style={{ color: '#A1A1AA' }}>Overview of your AI UGC Agent</p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-[6px] rounded-full px-3 py-[6px]"
            style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)', fontSize: '12px', fontWeight: 600 }}
          >
            <div className="w-[7px] h-[7px] rounded-full" style={{ background: '#9D6BF5' }} />
            Early Access
          </div>

          <div
            className="relative flex items-center justify-center rounded-[8px] cursor-pointer"
            style={{ width: '36px', height: '36px', background: '#141418', border: '1px solid rgba(255,255,255,0.07)', color: '#A1A1AA' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a2 2 0 01-2-2h4a2 2 0 01-2 2z" />
            </svg>
            <div
              className="absolute rounded-full"
              style={{ top: '5px', right: '5px', width: '7px', height: '7px', background: '#EF4444', border: '1.5px solid #0C0C0F' }}
            />
          </div>

          <Suspense fallback={null}>
            <BrandSwitcher brands={activeBrands} />
          </Suspense>

          <div
            className="flex items-center gap-2 rounded-full cursor-pointer"
            style={{ padding: '5px 12px 5px 5px', background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#c8a882,#a07850)' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-[12px] font-semibold">{userName}</div>
              <div className="text-[10px]" style={{ color: '#52525B' }}>
                {subscription?.tier ? subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1) : 'Starter'}
              </div>
            </div>
            <span className="text-[10px] ml-[2px]" style={{ color: '#52525B' }}>⌄</span>
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div style={{ padding: '24px 28px' }}>

        {/* Timeframe selector */}
        <Suspense fallback={null}>
          <TimeframeSelector current={timeframe} />
        </Suspense>

        {/* Stat cards — show 0 not — when no analytics data */}
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <StatCard
            label="Videos Created"
            value={totalCreated.toString()}
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            }
          />
          <StatCard
            label="Videos Posted"
            value={totalPosted.toString()}
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            }
          />
          <StatCard
            label="Views Generated"
            value={totalViews > 0 ? totalViews.toLocaleString() : '0'}
            changeLabel={totalViews > 0 ? tfLabel : 'No data yet'}
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            }
          />
          <StatCard
            label="Engagement Rate"
            value={avgEngagement > 0 ? `${avgEngagement.toFixed(1)}%` : '0%'}
            changeLabel={avgEngagement > 0 ? tfLabel : 'No data yet'}
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
            }
          />
          <StatCard
            label="Revenue Influenced"
            value="—"
            changeLabel="Coming soon"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            }
          />
        </div>

        {/* ── Middle row ── */}
        <div className="grid gap-[14px] mb-5" style={{ gridTemplateColumns: '1fr 380px' }}>
          <Suspense fallback={<AgentSkeleton />}>
            <AgentStatusWidget userId={user.id} />
          </Suspense>

          {/* Schedule widget — upcoming schedule → recent reels → empty CTA */}
          {scheduleItems.length > 0 ? (
            <ScheduleWidget items={scheduleItems} />
          ) : reelScheduleItems.length > 0 ? (
            <ScheduleWidget items={reelScheduleItems} title="Recent Posts" />
          ) : (
            <div
              className="rounded-[16px] p-5"
              style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-[15px] font-bold">Today&apos;s Schedule</div>
                <span className="text-[11px] font-semibold" style={{ color: '#52525B' }}>
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="py-6 text-center">
                <div className="text-2xl mb-3">📅</div>
                <p className="text-[13px] font-semibold text-white mb-1">No posts scheduled</p>
                <p className="text-[11px] mb-4" style={{ color: '#52525B' }}>
                  Generate a video to auto-schedule it
                </p>
                <a
                  href="/generate"
                  className="inline-flex items-center gap-[6px] rounded-[8px] px-4 py-[7px] text-[12px] font-semibold"
                  style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#9D6BF5' }}
                >
                  Generate &amp; Schedule →
                </a>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom row ── */}
        <div className="grid gap-[14px]" style={{ gridTemplateColumns: '1fr 260px' }}>

          {/* Recent Creations */}
          <div
            className="rounded-[16px] p-5"
            style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-[15px] font-bold">Recent Creations</div>
              <a href="/videos" className="text-[11px] font-semibold" style={{ color: '#9D6BF5' }}>
                View all →
              </a>
            </div>

            {allReels.length > 0 ? (
              // FIX 1: Show actual Metricool published reels (with real thumbnails + metrics)
              <div className="grid grid-cols-5 gap-[10px]">
                {allReels.slice(0, 5).map(reel => (
                  <ReelThumbCard key={reel.reelId} reel={reel as ReelData} />
                ))}
              </div>
            ) : recentVideos.length > 0 ? (
              // Fallback: Supabase generated videos not yet posted
              <div className="grid grid-cols-5 gap-[10px]">
                {recentVideos.map((video, i) => (
                  <VideoThumbCard key={video.id} video={video} index={i} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="text-4xl mb-3">🎬</div>
                <p className="font-semibold text-white text-sm">No videos yet</p>
                <p className="text-[12px] mt-1 mb-4" style={{ color: '#A1A1AA' }}>
                  Generate your first video to get started
                </p>
                <a
                  href="/generate"
                  className="inline-block rounded-lg px-5 py-2 text-[13px] font-semibold text-white"
                  style={{ background: '#7C3AED' }}
                >
                  Generate First Video
                </a>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-[14px]">
            <HookCard
              topHooks={latestInsights?.top_hooks ?? []}
              hookText={topHookText}
              timesUsed={topHookCount}
              viewRate="—"
              postsAnalyzed={latestInsights?.posts_analyzed ?? null}
              chartData={latestInsights?.chart_scores ?? undefined}
            />

            <InsightsCard
              insight={latestInsights?.ai_insight ?? latestInsight}
              recommendedHook={latestInsights?.recommended_hook ?? null}
            />

            {activeProjectId && (
              <InsightsAnalyzeButton
                projectId={activeProjectId}
                lastAnalyzedAt={latestInsights?.created_at ?? null}
              />
            )}

            {/* Subscription usage */}
            <div
              className="rounded-[16px] p-[14px]"
              style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="text-[9px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: '#52525B' }}>
                Current Plan
              </div>
              <div className="text-[13px] font-bold mb-[2px]">
                {subscription?.tier === 'scale' ? 'Scale Pro' : subscription?.tier ? subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1) : 'Starter'}
              </div>
              <div className="text-[11px] mb-2" style={{ color: '#A1A1AA' }}>
                {used} / {quota === 999 ? '∞' : quota} videos this cycle
              </div>
              <div className="h-[3px] rounded-full mb-[6px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${usagePercent}%`, background: 'linear-gradient(90deg,#7C3AED,#9D6BF5)' }}
                />
              </div>
              {daysUntilReset !== null && (
                <div className="text-[10px] mb-[10px]" style={{ color: '#52525B' }}>
                  Resets in {daysUntilReset} days
                </div>
              )}
              <a
                href="/billing"
                className="flex items-center justify-center gap-[6px] w-full py-2 rounded-[8px] text-[12px] font-semibold"
                style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#9D6BF5' }}
              >
                <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                Upgrade Plan
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AgentSkeleton() {
  return (
    <div
      className="rounded-[16px] animate-pulse"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)', height: '200px' }}
    />
  )
}
