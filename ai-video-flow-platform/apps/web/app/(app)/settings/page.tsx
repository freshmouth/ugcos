import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/app/settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, projectsResult, imagesResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    supabase.from('product_images').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  const projects = projectsResult.data ?? []
  const primaryProject = projects[0] ?? null

  return (
    <SettingsClient
      profile={profileResult.data}
      project={primaryProject}
      allProjects={projects}
      productImages={imagesResult.data ?? []}
    />
  )
}
