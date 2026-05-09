import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GenerateClient } from '@/components/app/generate-client'

const TIER_LIMITS: Record<string, number | null> = {
  starter: 30,
  growth: 60,
  scale: null, // unlimited
}

export default async function GeneratePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  console.log('[GENERATE] Fetching projects for userId:', user.id)

  const [subscriptionResult, projectsResult] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('tier, videos_used_this_cycle, status')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('projects')
      .select('*, product_images(id, url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  const projects = projectsResult.data ?? []
  console.log('[GENERATE] Projects for user:', projects.length)

  const sub = subscriptionResult.data
  let videosRemaining: number = Infinity
  if (sub && sub.status === 'active') {
    const limit = TIER_LIMITS[sub.tier] ?? 30
    videosRemaining = limit === null ? Infinity : Math.max(0, limit - (sub.videos_used_this_cycle ?? 0))
  }

  return (
    <GenerateClient
      projects={projects}
      videosRemaining={videosRemaining}
    />
  )
}
