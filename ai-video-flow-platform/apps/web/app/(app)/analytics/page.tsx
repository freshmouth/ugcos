import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AnalyticsVideoRow, type AnalyticsReel, type VideoBreakdown } from '@/components/app/analytics-video-row'
import { InsightsAnalyzeButton } from '@/components/app/insights-analyze-button'
import { AnalyticsTimeframeSelector } from '@/components/app/analytics-timeframe-selector'

// ─── Metricool helpers ────────────────────────────────────────────────────────

const MC_BASE = 'https://app.metricool.com'
const MC_USER_ID = process.env.METRICOOL_USER_ID ?? '4210220'

function mcHeaders() {
  return { 'X-Mc-Auth': process.env.METRICOOL_API_KEY ?? '', Accept: 'application/json' }
}

function toYYYYMMDD(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

function toIso(d: Date, b: 'start' | 'end') {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return b === 'start' ? `${y}-${m}-${day}T00:00:00` : `${y}-${m}-${day}T23:59:59`
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

async function mcFetch(url: string): Promise<unknown[]> {
  try {
    const res = await fetch(url, { headers: mcHeaders(), next: { revalidate: 300 } })
    if (!res.ok) return []
    return extractArray(await res.json())
  } catch { return [] }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type IGReel = {
  reelId?: string
  views?: number; impressionsTotal?: number; likes?: number; engagement?: number
  content?: string; imageUrl?: string; link?: string; url?: string
  publishedAt?: { dateTime?: string } | string; reach?: number
}
type FBReel = { blueReelsPlayCount?: number; engagement?: number; postVideoReactions?: number; reelUrl?: string }
type FBPost = { videoViews?: number; impressions?: number; engagement?: number }
type TimelineEntry = Record<string, unknown>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toString()
}

function Sparkline({ values, width = 100, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) {
    return <div style={{ height, borderRadius: 4, background: 'rgba(124,58,237,0.08)' }} />
  }
  const max = Math.max(...values), min = Math.min(...values)
  const range = max - min || 1
  const pad = 3
  const pts = values.map((v, i): [number, number] => [
    (i / (values.length - 1)) * (width - pad * 2) + pad,
    height - pad - ((v - min) / range) * (height - pad * 2),
  ])
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const area = [...pts.map(([x, y]) => `${x},${y}`), `${pts.at(-1)![0]},${height}`, `${pts[0]![0]},${height}`].join(' ')
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#aGrad)" points={area} />
      <polyline fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={line} />
    </svg>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tf?: string; brand?: string }>
}) {
  const { tf: tfParam, brand: selectedBrandId } = await searchParams
  const tf: '7d' | '30d' | 'all' = tfParam === '30d' ? '30d' : tfParam === 'all' ? 'all' : '7d'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const days = tf === '7d' ? 7 : tf === '30d' ? 30 : 90
  const now = new Date()
  const start = new Date(Date.now() - days * 86400000)
  const start90 = new Date(Date.now() - 90 * 86400000)

  // Active brands
  const { data: brandsData } = await supabase
    .from('projects')
    .select('id, name, metricool_brand_id, metricool_blog_name')
    .eq('user_id', user.id)
    .eq('active', true)
    .not('metricool_brand_id', 'is', null)

  const activeBrands = (brandsData ?? []).map(p => ({
    id: p.id as string,
    name: (p.metricool_blog_name ?? p.name) as string,
    blogId: p.metricool_brand_id as string,
  }))

  const brand = selectedBrandId
    ? activeBrands.find(b => b.id === selectedBrandId)
    : activeBrands[0]

  // Supabase video count for period
  const { count: videosCreated } = await supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', start.toISOString())

  // Latest insights
  const { data: insightsRaw } = await supabase
    .from('insights')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  type InsightRow = {
    top_hooks?: Array<{ text: string; avg_views: number; why_it_works: string }> | null
    winning_phrases?: Array<{ phrase: string; frequency: number; context: string }> | null
    content_patterns?: Array<{ pattern: string; example: string; avg_views: number }> | null
    ai_insight?: string | null; recommended_hook?: string | null
    best_posting_time?: string | null; best_content_type?: string | null
    video_breakdowns?: VideoBreakdown[] | null
    posts_analyzed?: number | null; created_at?: string; project_id?: string | null
  }
  const insights = insightsRaw as InsightRow | null

  const breakdownMap = new Map<string, VideoBreakdown>(
    (insights?.video_breakdowns ?? []).map(bd => [bd.postId, bd])
  )

  // If no brand, show empty state
  if (!brand) {
    return (
      <div className="px-7 py-6">
        <h1 className="text-[22px] font-bold mb-2">Analytics</h1>
        <div className="rounded-[16px] p-8 text-center" style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[14px] font-semibold mb-1">No brand configured</p>
          <p className="text-[12px] mb-4" style={{ color: '#52525B' }}>
            Go to Settings → My Brands to activate a Metricool brand
          </p>
          <a href="/settings" className="text-[12px] font-semibold" style={{ color: '#9D6BF5' }}>Go to Settings →</a>
        </div>
      </div>
    )
  }

  const blogId = brand.blogId
  const isoQS = (s: Date, e: Date) => `blogId=${blogId}&userId=${MC_USER_ID}&from=${encodeURIComponent(toIso(s, 'start'))}&to=${encodeURIComponent(toIso(e, 'end'))}`
  const ymdQS = `blogId=${blogId}&userId=${MC_USER_ID}&start=${toYYYYMMDD(start)}&end=${toYYYYMMDD(now)}`

  const [igReels90, igReelsPeriod, fbReels, fbPosts, timeline] = await Promise.all([
    mcFetch(`${MC_BASE}/api/v2/analytics/reels/instagram?${isoQS(start90, now)}`),
    mcFetch(`${MC_BASE}/api/v2/analytics/reels/instagram?${isoQS(start, now)}`),
    mcFetch(`${MC_BASE}/api/v2/analytics/reels/facebook?${isoQS(start, now)}`),
    mcFetch(`${MC_BASE}/api/stats/facebook/posts?${ymdQS}`),
    mcFetch(`${MC_BASE}/api/stats/timeline/igImpressions?${ymdQS}`),
  ])

  // Score top 10 (90d)
  const topReels: AnalyticsReel[] = (igReels90 as IGReel[])
    .map(r => {
      const views = r.views ?? r.impressionsTotal ?? 0
      const dateRaw = typeof r.publishedAt === 'string' ? r.publishedAt : (r.publishedAt as { dateTime?: string })?.dateTime ?? ''
      return {
        reelId: r.reelId ?? '',
        views,
        likes: r.likes ?? 0,
        engagement: r.engagement ?? 0,
        caption: r.content ?? '',
        date: dateRaw ? new Date(dateRaw).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
        isViral: views >= 50000,
        thumbnail: r.imageUrl ?? null,
        link: r.link ?? r.url ?? null,
        score: views * 0.5 + (r.likes ?? 0) * 0.3 + (r.engagement ?? 0) * 1000 * 0.2,
        rank: 0,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // Period stats
  const igViews = (igReelsPeriod as IGReel[]).reduce((s, r) => s + (r.views ?? r.impressionsTotal ?? 0), 0)
  const fbReelViews = (fbReels as FBReel[]).reduce((s, r) => s + (r.blueReelsPlayCount ?? 0), 0)
  const fbPostViews = (fbPosts as FBPost[]).reduce((s, p) => s + (p.videoViews ?? 0), 0)
  const totalViews = igViews + fbReelViews + fbPostViews
  const totalPosted = (igReelsPeriod as IGReel[]).length + (fbReels as FBReel[]).length + (fbPosts as FBPost[]).length
  const igER = (igReelsPeriod as IGReel[]).length > 0
    ? (igReelsPeriod as IGReel[]).reduce((s, r) => s + (r.engagement ?? 0), 0) / (igReelsPeriod as IGReel[]).length
    : 0
  const viralCount = (igReelsPeriod as IGReel[]).filter(r => (r.views ?? 0) >= 50000).length

  // Timeline sparkline values
  const timelineValues = (timeline as TimelineEntry[]).map(t =>
    Number(t.impressions ?? t.igImpressions ?? t.value ?? t.views ?? 0)
  ).filter(v => v > 0)

  // Platform breakdown stats
  const fbER = (fbReels as FBReel[]).length > 0
    ? (fbReels as FBReel[]).reduce((s, r) => s + (r.engagement ?? 0), 0) / (fbReels as FBReel[]).length
    : 0

  const cardStyle = { background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      {/* Topbar */}
      <div
        className="sticky top-0 z-40 px-7 flex items-center justify-between"
        style={{ background: 'rgba(12,12,15,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)', height: 64 }}
      >
        <div>
          <h1 className="text-[20px] font-bold tracking-[-0.5px]">Analytics</h1>
          <p className="text-[11px]" style={{ color: '#52525B' }}>{brand.name}</p>
        </div>
        <Suspense>
          <AnalyticsTimeframeSelector current={tf} />
        </Suspense>
      </div>

      <div className="px-7 py-6 flex flex-col gap-5" style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── SECTION A: Performance Overview ── */}
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.8px] mb-3" style={{ color: '#52525B' }}>
            Performance Overview
          </h2>

          {/* Stat cards */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Total Views', value: fmtNum(totalViews), sub: `vs prev period` },
              { label: 'Videos Posted', value: totalPosted.toString() },
              { label: 'Avg Engagement', value: igER.toFixed(2) + '%' },
              { label: 'Viral Videos', value: viralCount.toString(), highlight: viralCount > 0 },
              { label: 'Videos Created', value: (videosCreated ?? 0).toString() },
            ].map(c => (
              <div key={c.label} className="rounded-[14px] p-4" style={cardStyle}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.5px] mb-2" style={{ color: '#52525B' }}>{c.label}</div>
                <div
                  className="text-[22px] font-bold tracking-[-0.5px]"
                  style={{ color: c.highlight ? '#FBBF24' : '#FFFFFF' }}
                >
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          {/* Sparkline chart */}
          <div className="rounded-[14px] p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] font-bold">Instagram Impressions Over Time</div>
              {timelineValues.length === 0 && (
                <span className="text-[11px]" style={{ color: '#52525B' }}>No timeline data available</span>
              )}
            </div>
            {timelineValues.length >= 2 ? (
              <div style={{ height: 80 }}>
                <Sparkline values={timelineValues} width={1000} height={80} />
              </div>
            ) : (
              <div
                className="flex items-center justify-center rounded-[8px]"
                style={{ height: 80, background: 'rgba(124,58,237,0.04)', border: '1px dashed rgba(124,58,237,0.2)' }}
              >
                <span className="text-[12px]" style={{ color: '#52525B' }}>
                  Impression data not available from Metricool for this period
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── SECTION B: Top Performing Videos ── */}
        <div className="rounded-[16px] p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[15px] font-bold">Top Performing Videos</div>
              <div className="text-[11px] mt-[2px]" style={{ color: '#52525B' }}>Last 90 days — ranked by performance score</div>
            </div>
            <div
              className="text-[11px] px-2 py-1 rounded-[6px]"
              style={{ background: 'rgba(251,191,36,0.1)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.2)' }}
            >
              🔥 50K+ views = VIRAL
            </div>
          </div>

          {topReels.length === 0 ? (
            <p className="text-[12px] py-4" style={{ color: '#52525B' }}>No reels found in the last 90 days.</p>
          ) : (
            <div>
              {topReels.map(reel => (
                <AnalyticsVideoRow
                  key={reel.reelId}
                  reel={reel}
                  breakdown={breakdownMap.get(reel.reelId) ?? null}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── SECTION C: AI Insights Panel ── */}
        <div className="rounded-[16px] p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[15px] font-bold">AI Insights</div>
            {insights?.created_at && (
              <span className="text-[11px]" style={{ color: '#52525B' }}>
                Last analyzed: {new Date(insights.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {!insights ? (
            <div className="py-6 text-center">
              <p className="text-[14px] font-semibold mb-1">No analysis yet</p>
              <p className="text-[12px] mb-4" style={{ color: '#52525B' }}>
                Run an analysis to get AI-powered insights about your top performing content
              </p>
              {brand && (
                <InsightsAnalyzeButton
                  projectId={brand.id}
                  lastAnalyzedAt={null}
                />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* Left column */}
              <div>
                {(insights.top_hooks ?? []).length > 0 && (
                  <div className="mb-5">
                    <div className="text-[11px] font-bold uppercase tracking-[0.5px] mb-3" style={{ color: '#7C3AED' }}>
                      Top Performing Hooks
                    </div>
                    {(insights.top_hooks ?? []).slice(0, 3).map((hook, i) => (
                      <div key={i} className="mb-3 pb-3" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                        <div className="flex items-start gap-2">
                          <span className="text-[11px] font-bold" style={{ color: '#52525B' }}>#{i + 1}</span>
                          <div>
                            <p className="text-[12px] font-semibold leading-[1.4]">&ldquo;{hook.text}&rdquo;</p>
                            <p className="text-[11px] mt-1" style={{ color: '#52525B' }}>
                              {fmtNum(hook.avg_views)} avg views
                            </p>
                            {hook.why_it_works && (
                              <p className="text-[11px] mt-1 leading-[1.4]" style={{ color: '#71717A' }}>{hook.why_it_works}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(insights.winning_phrases ?? []).length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.5px] mb-3" style={{ color: '#7C3AED' }}>
                      Winning Phrases
                    </div>
                    {(insights.winning_phrases ?? []).slice(0, 3).map((wp, i) => (
                      <div key={i} className="mb-2 flex items-center justify-between">
                        <span className="text-[12px]">&ldquo;{wp.phrase}&rdquo;</span>
                        <span className="text-[10px] px-2 py-[2px] rounded-full ml-2 flex-shrink-0"
                          style={{ background: 'rgba(124,58,237,0.15)', color: '#9D6BF5' }}>
                          {wp.frequency}× used
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right column */}
              <div>
                {insights.ai_insight && (
                  <div className="mb-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.5px] mb-2" style={{ color: '#7C3AED' }}>AI Insight</div>
                    <p className="text-[12px] leading-[1.6]" style={{ color: '#A1A1AA' }}>{insights.ai_insight}</p>
                  </div>
                )}

                {(insights.content_patterns ?? []).length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.5px] mb-2" style={{ color: '#7C3AED' }}>Content Patterns</div>
                    {(insights.content_patterns ?? []).slice(0, 2).map((cp, i) => (
                      <div key={i} className="mb-2">
                        <p className="text-[12px] font-semibold">{cp.pattern}</p>
                        <p className="text-[11px]" style={{ color: '#52525B' }}>{cp.example?.slice(0, 60)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 mb-4">
                  {insights.best_posting_time && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: '#52525B' }}>Best Time</div>
                      <div className="text-[13px] font-bold">{insights.best_posting_time}</div>
                    </div>
                  )}
                  {insights.best_content_type && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: '#52525B' }}>Best Type</div>
                      <div className="text-[13px] font-bold capitalize">{insights.best_content_type}</div>
                    </div>
                  )}
                </div>

                {insights.recommended_hook && (
                  <div className="rounded-[10px] p-3" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.5px] mb-1" style={{ color: '#7C3AED' }}>Recommended Next Hook</div>
                    <p className="text-[12px] font-semibold" style={{ color: '#C4B5FD' }}>&ldquo;{insights.recommended_hook}&rdquo;</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Run Analysis button always shown */}
          {brand && insights && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <InsightsAnalyzeButton
                projectId={brand.id}
                lastAnalyzedAt={insights?.created_at ?? null}
              />
            </div>
          )}
        </div>

        {/* ── SECTION D: Platform Breakdown ── */}
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-[0.8px] mb-3" style={{ color: '#52525B' }}>
            Platform Breakdown
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Instagram */}
            <div className="rounded-[16px] p-5" style={cardStyle}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: '#E1306C' }}>IG</div>
                <div>
                  <div className="text-[14px] font-bold">Instagram Reels</div>
                  <div className="text-[11px]" style={{ color: '#52525B' }}>{tf} period</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatBlock label="Total Reels" value={(igReelsPeriod as IGReel[]).length.toString()} />
                <StatBlock label="Total Views" value={fmtNum(igViews)} />
                <StatBlock label="Avg Engagement" value={igER.toFixed(2) + '%'} />
                <StatBlock label="Viral (50K+)" value={viralCount.toString()} highlight={viralCount > 0} />
              </div>
              {topReels[0] && (
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: '#52525B' }}>Top Reel</div>
                  <p className="text-[11px] truncate" style={{ color: '#A1A1AA' }}>{topReels[0].caption || '—'}</p>
                  <p className="text-[12px] font-bold mt-1">{fmtNum(topReels[0].views)} views</p>
                </div>
              )}
            </div>

            {/* Facebook */}
            <div className="rounded-[16px] p-5" style={cardStyle}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: '#1877F2' }}>FB</div>
                <div>
                  <div className="text-[14px] font-bold">Facebook</div>
                  <div className="text-[11px]" style={{ color: '#52525B' }}>{tf} period</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatBlock label="Total Posts" value={((fbReels as FBReel[]).length + (fbPosts as FBPost[]).length).toString()} />
                <StatBlock label="Total Views" value={fmtNum(fbReelViews + fbPostViews)} />
                <StatBlock label="Avg Engagement" value={fbER.toFixed(2) + '%'} />
                <StatBlock label="FB Reels" value={(fbReels as FBReel[]).length.toString()} />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function StatBlock({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-[10px] p-3" style={{ background: '#0F0F12' }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.5px] mb-1" style={{ color: '#52525B' }}>{label}</div>
      <div className="text-[16px] font-bold" style={{ color: highlight ? '#FBBF24' : '#FFFFFF' }}>{value}</div>
    </div>
  )
}
