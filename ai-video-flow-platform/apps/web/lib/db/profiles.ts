import { createClient } from '@/lib/supabase/server'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  onboarding_done: boolean
  created_at: string
}

export async function getProfile(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data as Profile
}

export async function updateProfile(userId: string, data: Partial<Profile>) {
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return profile as Profile
}
