import { createClient } from '@/lib/supabase/server'

export type Video = {
  id: string
  project_id: string
  user_id: string
  status: string
  content_type: string | null
  script_prompt: string | null
  fal_image_url: string | null
  fal_video_url: string | null
  cloudinary_url: string | null
  captioned_url: string | null
  metricool_post_id: string | null
  error_message: string | null
  credits_used: number
  created_at: string
  updated_at: string
}

export async function getUserVideos(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Video[]
}

export async function getVideoById(id: string, userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data as Video
}

export async function createVideo(data: Partial<Video>) {
  const supabase = await createClient()
  const { data: video, error } = await supabase
    .from('videos')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return video as Video
}

export async function updateVideoStatus(
  id: string,
  status: string,
  extra?: Partial<Video>
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('videos')
    .update({ status, ...extra })
    .eq('id', id)
  if (error) throw error
}

export async function refundVideoCredits(userId: string, videoId: string) {
  const supabase = await createClient()
  const { error: creditError } = await supabase.rpc('increment_credits', {
    p_user_id: userId,
    p_amount: 30,
  })
  if (creditError) {
    const { error } = await supabase
      .from('credits')
      .update({ balance: supabase.rpc('credits_balance_plus_30', { p_user_id: userId }) })
      .eq('user_id', userId)
    if (error) throw error
  }
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount: 30,
    reason: 'refund',
    video_id: videoId,
  })
}
