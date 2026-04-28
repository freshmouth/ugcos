import type { SupabaseClient } from '@supabase/supabase-js'

export type PipelineLog = {
  id: string
  video_id: string
  stage: number
  stage_name: string
  status: 'started' | 'completed' | 'failed'
  duration_ms: number | null
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type InsertPipelineLogInput = {
  video_id: string
  stage: number
  stage_name: string
  status: 'started' | 'completed' | 'failed'
  duration_ms?: number
  error_message?: string
  metadata?: Record<string, unknown>
}

export async function insertPipelineLog(
  supabase: SupabaseClient,
  data: InsertPipelineLogInput
): Promise<void> {
  await supabase.from('pipeline_logs').insert({
    video_id: data.video_id,
    stage: data.stage,
    stage_name: data.stage_name,
    status: data.status,
    duration_ms: data.duration_ms ?? null,
    error_message: data.error_message ?? null,
    metadata: data.metadata ?? null,
  })
}

export async function getPipelineLogs(
  supabase: SupabaseClient,
  videoId: string
): Promise<PipelineLog[]> {
  const { data, error } = await supabase
    .from('pipeline_logs')
    .select('*')
    .eq('video_id', videoId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as PipelineLog[]
}
