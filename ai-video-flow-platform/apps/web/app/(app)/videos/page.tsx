import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/app/dashboard-client'

export default async function VideosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [videosResult, creditsResult, projectResult] = await Promise.all([
    supabase.from('videos').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('credits').select('balance').eq('user_id', user.id).single(),
    supabase.from('projects').select('id, name, instagram_connected, facebook_connected').eq('user_id', user.id).limit(1).single(),
  ])

  return (
    <DashboardClient
      userId={user.id}
      initialCredits={creditsResult.data?.balance ?? 0}
      initialVideos={videosResult.data ?? []}
      project={projectResult.data}
      showWelcome={false}
    />
  )
}
