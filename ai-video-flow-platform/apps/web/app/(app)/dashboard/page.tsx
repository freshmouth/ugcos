import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AgentStatusWidget } from '@/components/app/agent-status-widget'
import { StatCard } from '@/components/app/stat-card'
import { ScheduleWidget } from '@/components/app/schedule-widget'
import { VideoThumbCard } from '@/components/app/video-thumb-card'
import { HookCard } from '@/components/app/hook-card'
import { InsightsCard } from '@/components/app/insights-card'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const IN_PROGRESS = ['analyzing', 'scripting', 'generating_images', 'generating_video', 'assembling', 'captioning', 'posting']

  const [
    createdResult,
    postedResult,
    activeVideoResult,
    recentVideosResult,
    subscriptionResult,
    profileResult,
  ] = await Promise.all([
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'done'),
    supabase.from('videos').select('id, status').eq('user_id', user.id).in('status', IN_PROGRESS).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('videos').select('id, status, content_type, captioned_url, cloudinary_url, created_at, scene_plan').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('subscriptions').select('tier, videos_used_this_cycle, cycle_reset_date').eq('user_id', user.id).eq('status', 'active').single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  const totalCreated = createdResult.count ?? 0
  const totalPosted = postedResult.count ?? 0
  const activeVideo = activeVideoResult.data
  const recentVideos = (recentVideosResult.data ?? []).map(v => ({
    ...v,
    hook_text: v.scene_plan ? (v.scene_plan as { hook_text?: string }).hook_text ?? null : null,
  }))
  const subscription = subscriptionResult.data
  const profile = profileResult.data
  const userName = profile?.full_name ?? user.email?.split('@')[0] ?? 'User'

  const tierQuotas: Record<string, number> = { starter: 30, growth: 60, scale: 999 }
  const quota = tierQuotas[subscription?.tier ?? 'starter'] ?? 30
  const used = subscription?.videos_used_this_cycle ?? 0
  const usagePercent = Math.min((used / quota) * 100, 100)

  const resetDate = subscription?.cycle_reset_date
    ? new Date(subscription.cycle_reset_date)
    : null
  const daysUntilReset = resetDate
    ? Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / 86400000))
    : null

  const scheduleItems = recentVideos
    .filter(v => v.status === 'done')
    .slice(0, 3)
    .map((v, i) => ({
      time: ['9:00 AM', '12:00 PM', '6:00 PM'][i] ?? '9:00 AM',
      platform: 'instagram' as const,
      label: 'Instagram Reel',
      status: 'posted' as const,
    }))

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: '13px',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Topbar */}
      <div
        className="sticky top-0 z-40 px-7 flex items-center justify-between"
        style={{
          background: 'rgba(12,12,15,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          height: '64px',
        }}
      >
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.5px] leading-tight">Dashboard</h1>
          <p className="text-[12px] mt-[1px]" style={{ color: '#A1A1AA' }}>
            Overview of your AI UGC Agent
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-[6px] rounded-full px-3 py-[6px] text-[12px] font-semibold"
            style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="w-[7px] h-[7px] rounded-full" style={{ background: '#9D6BF5' }} />
            Early Access
          </div>
          <div
            className="flex items-center gap-2 rounded-full pl-[5px] pr-3 py-[5px] cursor-pointer"
            style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#c8a882,#a07850)' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-[12px] font-semibold">{userName}</div>
              <div className="text-[10px]" style={{ color: '#52525B' }}>
                {subscription?.tier ?? 'Starter'}
              </div>
            </div>
            <span className="text-[10px] ml-[2px]" style={{ color: '#52525B' }}>⌄</span>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="px-7 py-6">

        {/* Stat cards */}
        <div
          className="grid gap-3 mb-5"
          style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}
        >
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
            value="—"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
            }
          />
          <StatCard
            label="Engagement Rate"
            value="—"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
            }
          />
          <StatCard
            label="Revenue Influenced"
            value="—"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            }
          />
        </div>

        {/* Middle row: Agent Status + Schedule */}
        <div
          className="grid gap-[14px] mb-5"
          style={{ gridTemplateColumns: '1fr 380px' }}
        >
          <Suspense fallback={<AgentSkeleton />}>
            <AgentStatusWidget
              userId={user.id}
              initialStatus={activeVideo?.status as Parameters<typeof AgentStatusWidget>[0]['initialStatus'] ?? null}
              initialVideoId={activeVideo?.id ?? null}
            />
          </Suspense>
          <ScheduleWidget items={scheduleItems} />
        </div>

        {/* Bottom row: Recent Creations + Right col */}
        <div
          className="grid gap-[14px]"
          style={{ gridTemplateColumns: '1fr 260px' }}
        >
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
            {recentVideos.length > 0 ? (
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
              hookText="I wish I knew this sooner..."
              timesUsed={8}
              viewRate="78%"
            />
            <InsightsCard
              insight="Your morning posts (8-10 AM) are generating 3.2× more engagement than evening posts. Consider shifting your schedule to front-load morning slots for maximum reach this week."
            />

            {/* Subscription usage card */}
            <div
              className="rounded-[16px] p-[14px]"
              style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="text-[9px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: '#52525B' }}>
                Current Plan
              </div>
              <div className="text-[13px] font-bold mb-[2px]">
                {subscription?.tier ? subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1) : 'Starter'}
              </div>
              <div className="text-[11px] mb-2" style={{ color: '#A1A1AA' }}>
                {used} / {quota === Infinity ? '∞' : quota} videos this cycle
              </div>
              <div
                className="h-[3px] rounded-full mb-[6px] overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${usagePercent}%`,
                    background: 'linear-gradient(90deg,#7C3AED,#9D6BF5)',
                  }}
                />
              </div>
              {daysUntilReset !== null && (
                <div className="text-[10px] mb-[10px]" style={{ color: '#52525B' }}>
                  Resets in {daysUntilReset} days
                </div>
              )}
              <a
                href="/billing"
                className="flex items-center justify-center gap-[6px] w-full py-2 rounded-[8px] text-[12px] font-semibold transition-colors"
                style={{
                  background: 'rgba(124,58,237,0.15)',
                  border: '1px solid rgba(124,58,237,0.3)',
                  color: '#9D6BF5',
                }}
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
      className="rounded-[16px] p-6 animate-pulse"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)', height: '200px' }}
    />
  )
}
