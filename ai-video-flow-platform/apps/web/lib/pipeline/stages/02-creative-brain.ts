import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ComprehensionBrief, Project, ScenePlan } from '../types'
import { CREATIVE_BRAIN_MODEL } from '../utils/model-router'
import { enforceExactDuration } from '../utils/timing-enforcer'
import { getHookTemplate } from '../prompts/hook-templates'

export async function stage02CreativeBrain(
  brief: ComprehensionBrief,
  project: Project
): Promise<ScenePlan> {
  const hookSuggestion = getHookTemplate(brief.content_type)
  const sceneCount = calculateSceneCount(brief.target_duration)
  const durationPerScene = sceneCount === 1
    ? brief.target_duration
    : Math.floor(brief.target_duration / sceneCount)

  const systemInstruction = `You are a professional UGC video director. Generate a complete scene plan for a ${brief.target_duration}-second vertical video.
You MUST produce EXACTLY ${sceneCount} scene${sceneCount === 1 ? '' : 's'}. No more, no less.
The total duration of all scenes MUST sum to exactly ${brief.target_duration} seconds.
Return ONLY valid JSON matching the ScenePlan schema. No markdown, no explanation.`

  const sceneDurationRule = sceneCount === 1
    ? `- The single scene duration_seconds MUST be ${brief.target_duration}`
    : `- Each duration_seconds must be an integer between 1 and ${durationPerScene + 2}, summing to ${brief.target_duration}`

  const sceneTypeRule = sceneCount === 1
    ? `- Use type "talking_head" — a single continuous UGC moment with the product`
    : `- Scenes 1-2 should be hook/attention-grabbing (talking_head or product_reveal)\n- Include at least 1 product_reveal scene\n- Last scene should have a clear CTA\n- Mix scene types for visual variety`

  const userPrompt = `Product: ${project.name}
Description: ${project.product_description ?? 'lifestyle product'}
Target audience: ${project.target_audience ?? 'general audience'}
Content type: ${brief.content_type}
Hook type: ${brief.hook_type}
Narrative arc: ${brief.narrative_arc}
Pacing: ${brief.pacing}
Hook suggestion: "${hookSuggestion}"

Generate a ScenePlan JSON with EXACTLY ${sceneCount} scene${sceneCount === 1 ? '' : 's'}:
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
      "type": "talking_head | product_reveal | broll_lifestyle | product_closeup",
      "location": "specific location description",
      "outfit": "casual | athletic",
      "duration_seconds": ${durationPerScene},
      "camera": "camera angle description",
      "action": "what the person is doing",
      "background": "background scene description for image generation",
      "show_product": true,
      "motion": "motion description for video generation",
      "caption": "text overlay for this scene"
    }
  ]
}

Rules:
${sceneDurationRule}
${sceneTypeRule}
- "scenes" array length MUST be exactly ${sceneCount}`

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: CREATIVE_BRAIN_MODEL,
    systemInstruction,
  })

  const result = await model.generateContent(userPrompt)
  const text = result.response.text().trim()
  const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim()
  const plan = JSON.parse(jsonStr) as ScenePlan

  plan.scenes = enforceExactDuration(plan.scenes, brief.target_duration)
  plan.target_duration_seconds = brief.target_duration

  return plan
}

function calculateSceneCount(durationSeconds: number): number {
  if (durationSeconds <= 16) return 1
  if (durationSeconds <= 30) return 3
  return Math.min(6, Math.floor(durationSeconds / 5))
}
