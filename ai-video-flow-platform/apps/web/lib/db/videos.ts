import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScenePlan } from '@/lib/pipeline/types'

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
  scene_plan: ScenePlan | null
  character_reference_url: string | null
  assembly_path: string | null
  credits_used: number
  created_at: string
  updated_at: string
}

export type VideoWithProject = Video & {
  projects: {
    id: string
    name: string
    user_id: string
    metricool_brand_id: string | null
    instagram_connected: boolean
    facebook_connected: boolean
    character_reference_url: string | null
    voice_reference_url: string | null
    hooks_library: string[]
    product_description: string | null
    target_audience: string | null
    content_types: string[]
    script_prompts: string[]
    system_prompt: string | null
    cloudinary_folder: string | null
    active: boolean
    autopilot: boolean
  }
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

export async function getVideoWithProject(
  supabase: SupabaseClient,
  videoId: string
): Promise<VideoWithProject | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('*, projects(*)')
    .eq('id', videoId)
    .single()
  if (error) return null
  return data as VideoWithProject
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

export async function updateScenePlan(
  supabase: SupabaseClient,
  videoId: string,
  scenePlan: ScenePlan
): Promise<void> {
  await supabase.from('videos').update({ scene_plan: scenePlan }).eq('id', videoId)
}

export async function updateCloudinaryUrl(
  supabase: SupabaseClient,
  videoId: string,
  url: string
): Promise<void> {
  await supabase.from('videos').update({ cloudinary_url: url }).eq('id', videoId)
}

export async function updateCaptionedUrl(
  supabase: SupabaseClient,
  videoId: string,
  url: string
): Promise<void> {
  await supabase.from('videos').update({ captioned_url: url }).eq('id', videoId)
}

export async function updatePostId(
  supabase: SupabaseClient,
  videoId: string,
  postId: string
): Promise<void> {
  await supabase.from('videos').update({ metricool_post_id: postId }).eq('id', videoId)
}

export async function getRecentVideos(userId: string, limit = 5): Promise<Video[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Video[]
}

export async function getActiveVideo(userId: string): Promise<Video | null> {
  const supabase = await createClient()
  const IN_PROGRESS = ['analyzing', 'scripting', 'generating_images', 'generating_video', 'assembling', 'captioning', 'posting']
  const { data } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', userId)
    .in('status', IN_PROGRESS)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data as Video | null
}

export async function getDashboardStats(userId: string): Promise<{
  totalCreated: number
  totalPosted: number
}> {
  const supabase = await createClient()
  const [created, posted] = await Promise.all([
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('videos').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'done'),
  ])
  return {
    totalCreated: created.count ?? 0,
    totalPosted: posted.count ?? 0,
  }
}
