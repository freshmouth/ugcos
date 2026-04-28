import type { ComprehensionBrief, PipelineOptions } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPREHENSION_MODEL } from '../utils/model-router'

const DEFAULT_BRIEFS: Record<string, Omit<ComprehensionBrief, 'project_id' | 'content_type'>> = {
  shocking: { hook_type: 'pattern_interrupt', narrative_arc: 'reveal', pacing: 'fast', location_count: 3, cut_rhythm: 'quick_cuts', target_duration: 15 },
  informative: { hook_type: 'question', narrative_arc: 'educational', pacing: 'medium', location_count: 2, cut_rhythm: 'moderate', target_duration: 15 },
  transformation: { hook_type: 'before_after', narrative_arc: 'transformation', pacing: 'medium', location_count: 3, cut_rhythm: 'moderate', target_duration: 15 },
  viral: { hook_type: 'curiosity_gap', narrative_arc: 'surprise', pacing: 'fast', location_count: 2, cut_rhythm: 'quick_cuts', target_duration: 15 },
  emotional: { hook_type: 'relatable', narrative_arc: 'story', pacing: 'slow', location_count: 2, cut_rhythm: 'slow_cuts', target_duration: 15 },
  humor: { hook_type: 'pov', narrative_arc: 'comedic', pacing: 'fast', location_count: 2, cut_rhythm: 'quick_cuts', target_duration: 15 },
  sales: { hook_type: 'problem_solution', narrative_arc: 'cta', pacing: 'medium', location_count: 2, cut_rhythm: 'moderate', target_duration: 15 },
}

export async function stage01Comprehension(
  options: PipelineOptions,
  supabase: SupabaseClient
): Promise<ComprehensionBrief> {
  const { project, contentType, referenceVideoUrl } = options

  if (referenceVideoUrl && process.env.GEMINI_API_KEY) {
    try {
      return await analyzeReferenceVideo(referenceVideoUrl, project.id, contentType)
    } catch {
      // Fall through to default brief on Gemini failure
    }
  }

  const defaults = DEFAULT_BRIEFS[contentType] ?? DEFAULT_BRIEFS['informative']!
  return {
    ...defaults,
    content_type: contentType,
    project_id: project.id,
  }
}

async function analyzeReferenceVideo(
  videoUrl: string,
  projectId: string,
  contentType: string
): Promise<ComprehensionBrief> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: COMPREHENSION_MODEL })

  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) throw new Error(`Cannot fetch reference video: ${videoRes.status}`)
  const videoBuffer = await videoRes.arrayBuffer()
  const videoBase64 = Buffer.from(videoBuffer).toString('base64')
  const mimeType = videoRes.headers.get('content-type') ?? 'video/mp4'

  const prompt = `Analyze this UGC marketing video and extract the following as JSON:
{
  "hook_type": "one of: pattern_interrupt | question | curiosity_gap | before_after | relatable | pov | problem_solution",
  "narrative_arc": "brief description of the story structure",
  "pacing": "slow | medium | fast",
  "location_count": number_of_distinct_locations,
  "cut_rhythm": "slow_cuts | moderate | quick_cuts",
  "target_duration": 15
}

Only return valid JSON, no markdown.`

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: mimeType as 'video/mp4', data: videoBase64 } },
  ])

  const text = result.response.text().trim()
  const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, ''))

  return {
    ...parsed,
    content_type: contentType,
    project_id: projectId,
  } as ComprehensionBrief
}
