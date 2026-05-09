import { createClient } from '@/lib/supabase/server'

export type Project = {
  id: string
  user_id: string
  name: string
  product_description: string | null
  target_audience: string | null
  product_category: string | null
  content_types: string[]
  posting_frequency: string
  posting_time: string
  metricool_brand_id: string | null
  metricool_blog_name: string | null
  instagram_connected: boolean
  facebook_connected: boolean
  active: boolean
  autopilot: boolean
  system_prompt: string | null
  script_prompts: string[]
  cloudinary_folder: string | null
  created_at: string
  updated_at: string
}

export async function createProject(data: Partial<Project>) {
  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('projects')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return project as Project
}

export async function updateProject(id: string, data: Partial<Project>) {
  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('projects')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return project as Project
}

export async function getProject(id: string) {
  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return project as Project
}

export async function getUserProjects() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

export async function updateProjectSocial(
  id: string,
  data: {
    metricool_brand_id?: string | null
    instagram_connected?: boolean
    facebook_connected?: boolean
  }
) {
  return updateProject(id, data)
}

export async function updateAutopilot(
  id: string,
  data: {
    autopilot?: boolean
    posting_time?: string
    content_types?: string[]
  }
) {
  return updateProject(id, data)
}
