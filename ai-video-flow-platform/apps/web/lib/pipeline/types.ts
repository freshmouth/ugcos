export type SceneType =
  | 'talking_head'
  | 'product_reveal'
  | 'broll_lifestyle'
  | 'product_closeup'
  | 'broll_stock'

export type Scene = {
  id: number
  type: SceneType
  location: string
  outfit: 'casual' | 'athletic'
  duration_seconds: number
  camera: string
  action: string
  background: string
  show_product: boolean
  motion: string
  caption: string
  broll_source?: string
  image_url?: string
  clip_url?: string
}

export type ScenePlan = {
  total_scenes: number
  target_duration_seconds: number
  avatar: {
    description: string
    outfit_casual: string
    outfit_athletic: string
  }
  props: {
    continuity_prop: string
    product_description: string
  }
  hook_text: string
  scenes: Scene[]
}

export type ComprehensionBrief = {
  hook_type: string
  narrative_arc: string
  pacing: 'slow' | 'medium' | 'fast'
  location_count: number
  cut_rhythm: string
  content_type: string
  target_duration: number
  project_id: string
}

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
  instagram_connected: boolean
  facebook_connected: boolean
  active: boolean
  autopilot: boolean
  system_prompt: string | null
  script_prompts: string[]
  cloudinary_folder: string | null
  character_reference_url: string | null
  voice_reference_url: string | null
  hooks_library: string[]
  created_at: string
  updated_at: string
}

export type PipelineOptions = {
  project: Project
  userId: string
  videoId: string
  contentType: string
  customPrompt?: string
  referenceVideoUrl?: string
  triggeredBy: 'manual' | 'cron'
}

export type PipelineResult = {
  success: boolean
  error?: string
  cloudinary_url?: string
  captioned_url?: string
  post_ids?: string[]
}

export type StageContext = {
  videoId: string
  userId: string
  project: Project
  contentType: string
}
