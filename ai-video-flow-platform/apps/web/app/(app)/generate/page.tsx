import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GenerateClient } from '@/components/app/generate-client'

export default async function GeneratePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [creditsResult, projectResult] = await Promise.all([
    supabase.from('credits').select('balance').eq('user_id', user.id).single(),
    supabase.from('projects').select('*, product_images(id, url)').eq('user_id', user.id).single(),
  ])

  const project = projectResult.data
  const credits = creditsResult.data?.balance ?? 0

  return (
    <GenerateClient
      project={project}
      credits={credits}
    />
  )
}
