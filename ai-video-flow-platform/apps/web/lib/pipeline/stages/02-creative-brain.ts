// @ts-expect-error — installed at runtime: npm install @anthropic-ai/sdk
import Anthropic from '@anthropic-ai/sdk'
import type { ComprehensionBrief, Project, ScenePlan } from '../types'
import { CREATIVE_BRAIN_MODEL } from '../utils/model-router'
import { enforceExactDuration } from '../utils/timing-enforcer'
import { getHookTemplate } from '../prompts/hook-templates'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function stage02CreativeBrain(
  brief: ComprehensionBrief,
  project: Project
): Promise<ScenePlan> {
  const hookSuggestion = getHookTemplate(brief.content_type)
  const sceneCount = calculateSceneCount(brief.target_duration)

  const systemPrompt = `You are a professional UGC video director. Generate a complete scene plan for a ${brief.target_duration}-second vertical video.
The total duration of all scenes MUST sum to exactly ${brief.target_duration} seconds.
Return ONLY valid JSON matching the ScenePlan schema. No markdown, no explanation.`

  const userPrompt = `Product: ${project.name}
Description: ${project.product_description ?? 'lifestyle product'}
Target audience: ${project.target_audience ?? 'general audience'}
Content type: ${brief.content_type}
Hook type: ${brief.hook_type}
Narrative arc: ${brief.narrative_arc}
Pacing: ${brief.pacing}
Location count: ${brief.location_count}
Hook suggestion: "${hookSuggestion}"

Generate a ScenePlan JSON with this exact schema:
{
  "total_scenes": ${sceneCount},
  "target_duration_seconds": ${brief.target_duration},
  "avatar": {
    "description": "detailed character description for AI image generation",
    "outfit_casual": "specific casual outfit description",
    "outfit_athletic": "specific athletic/active outfit description"
  },
  "props": {
    "continuity_prop": "item that appears throughout video for consistency",
    "product_description": "how the product looks and should be held"
  },
  "hook_text": "the opening caption overlay text (max 8 words)",
  "scenes": [
    {
      "id": 1,
      "type": "talking_head | product_reveal | broll_lifestyle | product_closeup | broll_stock",
      "location": "specific location description",
      "outfit": "casual | athletic",
      "duration_seconds": 1-3,
      "camera": "camera angle description",
      "action": "what the person is doing",
      "background": "background scene description for image generation",
      "show_product": true/false,
      "motion": "motion description for video generation",
      "caption": "text overlay for this scene",
      "broll_source": "search term for Pexels (only for broll_stock type)"
    }
  ]
}

Rules:
- Scene durations must sum to exactly ${brief.target_duration} seconds
- Scenes 1-2 should be hook/attention-grabbing (talking_head or product_reveal)
- Include at least 1 product_reveal scene
- Last scene should have a clear CTA
- Mix scene types for visual variety
- Each duration_seconds must be an integer between 1 and 4`

  const message = await client.messages.create({
    model: CREATIVE_BRAIN_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = (message.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim()
  const plan = JSON.parse(jsonStr) as ScenePlan

  plan.scenes = enforceExactDuration(plan.scenes, brief.target_duration)
  plan.target_duration_seconds = brief.target_duration

  return plan
}

function calculateSceneCount(durationSeconds: number): number {
  if (durationSeconds <= 10) return 6
  if (durationSeconds <= 15) return Math.floor(durationSeconds / 1.2)
  return Math.min(18, Math.floor(durationSeconds / 1.0))
}
