import OpenAI from 'openai'
import { fal } from '@fal-ai/client'
import type { ScenePlan, Scene } from '../types'
import { withRetry } from '../utils/retry'
import { SORA_VIDEO_ENGINE_SYSTEM_PROMPT } from '../prompts/sora-video-prompt'
import { SEEDANCE_VIDEO_ENGINE_SYSTEM_PROMPT, SEEDANCE_PROMPT_LOCK } from '../prompts/seedance-video-prompt'
import { CONTENT_TYPES } from '../prompts/content-types'
import { selectVideoModel, getModelId, getMaxDuration, type VideoModel } from '../utils/model-router'

fal.config({ credentials: process.env.FAL_KEY })

type FalVideoResult = {
  data?: { video?: { url: string }; url?: string }
}

import type { Project } from '../types'

export async function stage04VideoGeneration(
  plan: ScenePlan,
  contentType = 'informative',
  project?: Pick<Project, 'product_description' | 'target_audience' | 'name'>,
  options?: { forceAudio?: boolean }
): Promise<ScenePlan> {
  // On forceAudio retry, switch to Seedance which reliably generates real audio
  const model = options?.forceAudio ? 'seedance-fast' : await selectVideoModel()
  const modelId = getModelId(model)
  const duration = getMaxDuration(model)
  if (options?.forceAudio) console.log(`[VIDEO MODEL] Audio retry — switching to ${model} | ${duration}s | ${modelId}`)
  else console.log(`[VIDEO MODEL] ${model} | ${duration}s | ${modelId}`)

  const forceAudio = options?.forceAudio ?? false
  const scenes = plan.scenes
  const mid = Math.ceil(scenes.length / 2)
  const [results1, results2] = await Promise.all([
    Promise.all(scenes.slice(0, mid).map(s => generateSceneClip(s, contentType, model, modelId, duration, project, forceAudio))),
    Promise.all(scenes.slice(mid).map(s => generateSceneClip(s, contentType, model, modelId, duration, project, forceAudio))),
  ])

  const allResults = [...results1, ...results2]
  const failures = allResults.filter(r => r.error)
  if (failures.length > 0) {
    const reasons = failures.map(r => r.error).join(' | ')
    throw new Error(`Scene generation failed (${failures.length}/${scenes.length}): ${reasons}`)
  }

  const sceneMap = new Map<number, { clip_url?: string }>()
  scenes.forEach((scene, i) => sceneMap.set(scene.id, allResults[i]!))

  return {
    ...plan,
    scenes: plan.scenes.map(scene => ({
      ...scene,
      clip_url: sceneMap.get(scene.id)?.clip_url,
    })),
  }
}

async function generateVideoPrompt(scene: Scene, contentType: string, model: VideoModel, duration: number, project?: Pick<Project, 'product_description' | 'target_audience' | 'name'>, forceAudio = false): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const contentTypeConfig = CONTENT_TYPES[contentType]
  const generatedImageUrl = scene.image_url ?? ''

  const isSora = model === 'sora'
  const systemPrompt = isSora ? SORA_VIDEO_ENGINE_SYSTEM_PROMPT : SEEDANCE_VIDEO_ENGINE_SYSTEM_PROMPT
  const promptLock = isSora
    ? (contentTypeConfig?.promptLock ?? '')
    : SEEDANCE_PROMPT_LOCK

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Create a ${isSora ? 'Sora 2 Pro' : 'Seedance 2.0'} video prompt for this product video:

Product: ${project?.product_description ?? 'Sal Céltica Marina Fina — a premium sea salt from Brittany, France. Rich in 82 essential minerals. Unrefined, sun-dried, naturally harvested.'}
Target audience: ${project?.target_audience ?? 'health-conscious women 25-40 in Mexico and Latin America.'}.
Content type: ${contentTypeConfig?.label ?? contentType}
Duration: ${duration} seconds
Language: Spanish (native Mexican/LATAM cadence)
Model: ${isSora ? 'Sora 2 — descriptive atmospheric prompts' : 'Seedance 2.0 — shot list cinematic direction'}

${generatedImageUrl ? `The video starts from this generated image:\n${generatedImageUrl}\nThe talent is already in scene with the product.` : 'Create a natural UGC moment with the product.'}
Make it feel like an accidentally captured real TikTok moment.

${forceAudio ? `AUDIO IS MANDATORY: The talent MUST speak clearly and audibly throughout the entire video in Spanish. Include natural speech, reactions, and product commentary. The audio track must contain real, intelligible dialogue — not silence. This is a hard requirement.\n\n` : ''}${promptLock}`,
      },
    ],
  })

  const prompt = response.choices[0]?.message?.content?.trim()
  if (!prompt) throw new Error(`GPT-4o returned empty ${model} prompt`)
  console.log(`[${model.toUpperCase()}-PROMPT] Generated prompt:\n`, prompt)
  return prompt
}

async function generateSceneClip(
  scene: Scene,
  contentType: string,
  model: VideoModel,
  modelId: string,
  duration: number,
  project?: Pick<Project, 'product_description' | 'target_audience' | 'name'>,
  forceAudio = false,
): Promise<{ clip_url?: string; error?: string }> {
  // Seedance requires a source image — fail explicitly so stage 3 errors surface clearly
  const requiresImage = model === 'seedance-fast' || model === 'seedance-standard'
  if (requiresImage && !scene.image_url) {
    return { error: `Scene ${scene.id}: ${model} requires a source image — check that stage 3 image generation succeeded` }
  }

  try {
    const clip_url = await withRetry(async () => {
      const videoPrompt = await generateVideoPrompt(scene, contentType, model, duration, project, forceAudio)

      const isSora = model === 'sora'
      const falInput: Record<string, unknown> = {
        prompt: videoPrompt,
        ...(scene.image_url ? { image_url: scene.image_url } : {}),
        duration: duration,
        aspect_ratio: '9:16',
        generate_audio: true,
      }

      if (!isSora) {
        falInput.resolution = '720p'
      }

      const result = await fal.subscribe(modelId, {
        input: falInput,
        logs: true,
        onQueueUpdate: (update: { status: string; logs?: Array<{ message: string }> }) => {
          console.log(`[${model.toUpperCase()}] Status:`, update.status)
          if (update.logs) update.logs.map(l => l.message).forEach(m => console.log(`[${model.toUpperCase()}]`, m))
        },
      }) as FalVideoResult

      const url = result?.data?.video?.url ?? result?.data?.url
      if (!url) throw new Error(`No video URL returned from ${model}`)
      return url
    }, 2, 2000)

    console.log(`[PIPELINE] Stage 4: Scene ${scene.id} generated via ${model}`)
    return { clip_url }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { error: `Scene ${scene.id}: ${model} failed: ${msg}` }
  }
}

