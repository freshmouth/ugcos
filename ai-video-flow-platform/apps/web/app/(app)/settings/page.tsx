import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/app/settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, projectResult, imagesResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('projects').select('*').eq('user_id', user.id).single(),
    supabase.from('product_images').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  return (
    <SettingsClient
      profile={profileResult.data}
      project={projectResult.data}
      productImages={imagesResult.data ?? []}
    />
  )
}
