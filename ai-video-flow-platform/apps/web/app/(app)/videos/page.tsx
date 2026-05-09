import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VideosClient } from '@/components/app/videos-client'

const MC_BASE = 'https://app.metricool.com'
const MC_USER_ID = process.env.METRICOOL_USER_ID ?? '4210220'

type IGReelRaw = {
  reelId?: string
  views?: number
  videoViews?: number
  impressionsTotal?: number
  likes?: number
  engagement?: number
  engagementRate?: number
  imageUrl?: string
  link?: string
  url?: string
}

export type MetricEntry = {
  views: number
  likes: number
  engagement: number
  thumbnail: string | null
  postLink: string | null
}

export default async function VideosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [videosResult, projectResult] = await Promise.all([
    // Only fetch posted videos: status=done AND metricool_post_id IS NOT NULL
    supabase
      .from('videos')
      .select('id, status, content_type, captioned_url, cloudinary_url, fal_image_url, created_at, updated_at, script_prompt, scene_plan, metricool_post_id')
      .eq('user_id', user.id)
      .eq('status', 'done')
      .not('metricool_post_id', 'is', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('projects')
      .select('instagram_connected, facebook_connected, metricool_brand_id')
      .eq('user_id', user.id)
      .limit(1)
      .single(),
  ])

  const rawVideos = (videosResult.data ?? []).map(v => ({
    ...v,
    hook_text: v.scene_plan
      ? (v.scene_plan as { hook_text?: string }).hook_text ?? null
      : null,
  }))

  const project = projectResult.data
  const instagramConnected = project?.instagram_connected ?? false
  const facebookConnected = project?.facebook_connected ?? false
  const blogId = project?.metricool_brand_id ?? null

  let metricsMap: Record<string, MetricEntry> = {}

  if (blogId && process.env.METRICOOL_API_KEY) {
    try {
      const now = new Date()
      const start = new Date(Date.now() - 90 * 86400000)
      const pad = (n: number) => String(n).padStart(2, '0')
      const toISO = (d: Date, b: 'start' | 'end') => {
        const y = d.getFullYear(), m = pad(d.getMonth() + 1), day = pad(d.getDate())
        return b === 'start' ? `${y}-${m}-${day}T00:00:00` : `${y}-${m}-${day}T23:59:59`
      }
      const qs = `blogId=${blogId}&userId=${MC_USER_ID}&from=${encodeURIComponent(toISO(start, 'start'))}&to=${encodeURIComponent(toISO(now, 'end'))}`
      const res = await fetch(`${MC_BASE}/api/v2/analytics/reels/instagram?${qs}`, {
        headers: { 'X-Mc-Auth': process.env.METRICOOL_API_KEY, Accept: 'application/json' },
        next: { revalidate: 3600 },
      })
      if (res.ok) {
        const json = await res.json()
        const reels: IGReelRaw[] = Array.isArray(json) ? json : (json?.data ?? json?.items ?? [])
        for (const r of reels) {
          if (r.reelId) {
            metricsMap[r.reelId] = {
              views: r.videoViews ?? r.views ?? r.impressionsTotal ?? 0,
              likes: r.likes ?? 0,
              engagement: r.engagementRate ?? r.engagement ?? 0,
              thumbnail: r.imageUrl ?? null,
              postLink: r.link ?? r.url ?? null,
            }
          }
        }
      }
    } catch { /* silently fail, metrics just won't show */ }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-white">My Videos</h1>
        <p className="text-[13px] mt-1" style={{ color: '#52525B' }}>Videos posted to Instagram &amp; Facebook</p>
      </div>
      <VideosClient
        videos={rawVideos}
        instagramConnected={instagramConnected}
        facebookConnected={facebookConnected}
        metricsMap={metricsMap}
      />
    </div>
  )
}
