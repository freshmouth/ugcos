import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    if (Array.isArray(d.posts)) return d.posts
    if (Array.isArray(d.items)) return d.items
  }
  return []
}

// Confirmed from swagger + diagnosis: ISO datetime format for v2 scheduler endpoint
function fmtISO(d: Date, boundary: 'start' | 'end' = 'start') {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return boundary === 'start' ? `${y}-${m}-${day}T00:00:00` : `${y}-${m}-${day}T23:59:59`
}

async function safeJson<T>(res: Response): Promise<T[]> {
  if (!res.ok) return []
  try { return extractArray(await res.json()) as T[] } catch { return [] }
}

// Confirmed field names from diagnosis:
// IG reel (v2/analytics/reels/instagram): reelId, views, impressionsTotal, engagement (%), imageUrl, content, publishedAt.dateTime
// FB reel (v2/analytics/reels/facebook): reelId, blueReelsPlayCount, thumbnailUrl (Metricool CDN), description, engagement, created.dateTime
// FB post (stats/facebook/posts): postId, videoViews, reactions, picture, text, created (ms)
type IGReel = {
  reelId?: string
  views?: number
  impressionsTotal?: number
  reach?: number
  engagement?: number
  likes?: number
  content?: string
  imageUrl?: string
  durationSeconds?: number
  publishedAt?: { dateTime?: string } | string
}

type FBReel = {
  reelId?: string
  blueReelsPlayCount?: number   // play count for FB reels
  thumbnailUrl?: string          // Metricool CDN — reliable, no 403
  description?: string
  length?: number
  engagement?: number
  postVideoReactions?: number
  created?: { dateTime?: string; timezone?: string }
  reelUrl?: string
}

type FBPost = {
  postId?: string
  videoViews?: number
  impressions?: number
  reactions?: number
  engagement?: number
  picture?: string
  text?: string
  created?: number   // milliseconds
  timestamp?: number
  permalinkUrl?: string
  type?: string
}

type SchedPost = {
  status?: string; state?: string
  scheduledAt?: string; publishDate?: string; date?: string
  networks?: string[]; socialNetworks?: string[]; network?: string
  text?: string; picture?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    blogId: string
    startDate: string       // YYYYMMDD
    endDate: string         // YYYYMMDD
    prevStartDate: string   // YYYYMMDD
    prevEndDate: string     // YYYYMMDD
    projectId: string
  }
  const { blogId, startDate, endDate, prevStartDate, prevEndDate, projectId } = body

  if (!process.env.METRICOOL_API_KEY) return NextResponse.json({ error: 'No API key' }, { status: 500 })

  const yyyymmdd = (s: string, e: string) =>
    `blogId=${blogId}&userId=${MC_USER_ID}&start=${s}&end=${e}`

  // v2 reels endpoint uses ISO datetime (YYYYMMDD silently drops reels for some brands)
  const toISO = (yyyymmdd: string, boundary: 'start' | 'end') => {
    const y = yyyymmdd.slice(0, 4), m = yyyymmdd.slice(4, 6), d = yyyymmdd.slice(6, 8)
    return boundary === 'start' ? `${y}-${m}-${d}T00:00:00` : `${y}-${m}-${d}T23:59:59`
  }
  const reelsQS = (s: string, e: string) =>
    `blogId=${blogId}&userId=${MC_USER_ID}&from=${encodeURIComponent(toISO(s, 'start'))}&to=${encodeURIComponent(toISO(e, 'end'))}`

  const now = new Date()
  const sevenDaysOut = fmtISO(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'end')
  const nowISO = fmtISO(now)

  const [igReelsRes, prevIgReelsRes, fbReelsRes, prevFbReelsRes, fbPostsRes, prevFbPostsRes, scheduledRes] = await Promise.allSettled([
    // IG reels — ISO datetime required; YYYYMMDD silently returns 0 for some brands
    fetch(`${MC_BASE}/api/v2/analytics/reels/instagram?${reelsQS(startDate, endDate)}`, { headers: mcHeaders() }),
    fetch(`${MC_BASE}/api/v2/analytics/reels/instagram?${reelsQS(prevStartDate, prevEndDate)}`, { headers: mcHeaders() }),
    // FB reels — confirmed: blueReelsPlayCount is play count; thumbnailUrl is Metricool CDN
    fetch(`${MC_BASE}/api/v2/analytics/reels/facebook?${reelsQS(startDate, endDate)}`, { headers: mcHeaders() }),
    fetch(`${MC_BASE}/api/v2/analytics/reels/facebook?${reelsQS(prevStartDate, prevEndDate)}`, { headers: mcHeaders() }),
    // FB regular posts (videoViews for non-reel videos)
    fetch(`${MC_BASE}/api/stats/facebook/posts?${yyyymmdd(startDate, endDate)}`, { headers: mcHeaders() }),
    fetch(`${MC_BASE}/api/stats/facebook/posts?${yyyymmdd(prevStartDate, prevEndDate)}`, { headers: mcHeaders() }),
    // Upcoming scheduled posts
    fetch(
      `${MC_BASE}/api/v2/scheduler/posts?blogId=${blogId}&userId=${MC_USER_ID}&start=${encodeURIComponent(nowISO)}&end=${encodeURIComponent(sevenDaysOut)}`,
      { headers: mcHeaders() }
    ),
  ])

  const igReels    = igReelsRes.status    === 'fulfilled' ? await safeJson<IGReel>(igReelsRes.value)    : []
  const prevIGReels = prevIgReelsRes.status === 'fulfilled' ? await safeJson<IGReel>(prevIgReelsRes.value) : []
  const fbReels    = fbReelsRes.status    === 'fulfilled' ? await safeJson<FBReel>(fbReelsRes.value)    : []
  const prevFBReels = prevFbReelsRes.status === 'fulfilled' ? await safeJson<FBReel>(prevFbReelsRes.value) : []
  const fbPosts    = fbPostsRes.status    === 'fulfilled' ? await safeJson<FBPost>(fbPostsRes.value)    : []
  const prevFbPosts = prevFbPostsRes.status === 'fulfilled' ? await safeJson<FBPost>(prevFbPostsRes.value) : []
  const scheduled  = scheduledRes.status  === 'fulfilled' ? await safeJson<SchedPost>(scheduledRes.value) : []

  const sumViews = (ig: IGReel[], fbR: FBReel[], fbP: FBPost[]) =>
    ig.reduce((s, r) => s + (r.views ?? r.impressionsTotal ?? 0), 0) +
    fbR.reduce((s, r) => s + (r.blueReelsPlayCount ?? 0), 0) +
    fbP.reduce((s, p) => s + (p.videoViews ?? 0), 0)

  const avgER = (ig: IGReel[], fbR: FBReel[]) => {
    const all = [...ig, ...fbR]
    return all.length > 0 ? all.reduce((s, r) => s + (r.engagement ?? 0), 0) / all.length : 0
  }

  const pct = (curr: number, prev: number) =>
    prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null

  const views     = sumViews(igReels, fbReels, fbPosts)
  const prevViews = sumViews(prevIGReels, prevFBReels, prevFbPosts)
  const er        = Math.round(avgER(igReels, fbReels) * 100) / 100
  const prevER    = Math.round(avgER(prevIGReels, prevFBReels) * 100) / 100

  const postsCount     = igReels.length + fbReels.length + fbPosts.length
  const prevPostsCount = prevIGReels.length + prevFBReels.length + prevFbPosts.length

  const startIso = `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}T00:00:00`
  const endIso   = `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}T23:59:59`
  const { count: videosCreated } = await supabase
    .from('videos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .gte('created_at', startIso)
    .lte('created_at', endIso)

  // Normalised posts for Recent Creations, sorted newest-first
  const recentIG = igReels.map(r => ({
    id: r.reelId, platform: 'instagram' as const,
    thumbnail: r.imageUrl ?? null,
    text: r.content ?? null,
    views: r.views ?? r.impressionsTotal ?? 0,
    likes: r.likes ?? 0,
    engagementRate: r.engagement ?? 0,
    publishedAt: typeof r.publishedAt === 'string'
      ? r.publishedAt
      : (r.publishedAt as { dateTime?: string } | undefined)?.dateTime ?? null,
  }))

  // FB reels use thumbnailUrl (Metricool CDN — reliable) and blueReelsPlayCount
  const recentFBReels = fbReels.map(r => ({
    id: r.reelId, platform: 'facebook' as const,
    thumbnail: r.thumbnailUrl ?? null,
    text: r.description ?? null,
    views: r.blueReelsPlayCount ?? 0,
    likes: r.postVideoReactions ?? 0,
    engagementRate: r.engagement ?? 0,
    publishedAt: r.created?.dateTime ?? null,
  }))

  const recentFBPosts = fbPosts.map(p => ({
    id: p.postId, platform: 'facebook' as const,
    thumbnail: p.picture ?? null,
    text: p.text ?? null,
    views: p.videoViews ?? 0,
    likes: p.reactions ?? 0,
    engagementRate: p.engagement ?? 0,
    publishedAt: p.created ? new Date(p.created).toISOString() : null,
  }))

  const posts = [...recentIG, ...recentFBReels, ...recentFBPosts]
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, 5)

  return NextResponse.json({
    videos_created: videosCreated ?? 0,
    videos_posted: postsCount,
    views,
    engagement_rate: er,
    revenue: null,
    posts,
    schedule: scheduled,
    change_vs_previous: {
      videos_posted: pct(postsCount, prevPostsCount),
      views: pct(views, prevViews),
      engagement_rate: pct(er, prevER),
    },
  })
}
