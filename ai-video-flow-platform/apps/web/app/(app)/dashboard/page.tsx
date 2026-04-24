import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/app/dashboard-client'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  const [creditsResult, videosResult, projectsResult] = await Promise.all([
    supabase.from('credits').select('balance').eq('user_id', user.id).single(),
    supabase.from('videos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, instagram_connected, facebook_connected').eq('user_id', user.id).limit(1).single(),
  ])

  return (
    <Suspense fallback={null}>
      <DashboardClient
        userId={user.id}
        initialCredits={creditsResult.data?.balance ?? 0}
        initialVideos={videosResult.data ?? []}
        project={projectsResult.data}
        showWelcome={params.welcome === 'true'}
      />
    </Suspense>
  )
}
