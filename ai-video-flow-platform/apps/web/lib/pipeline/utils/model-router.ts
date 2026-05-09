import type { SceneType } from '../types'

export type ModelChoice = {
  model: string
  reason: string
}

export function selectImageModel(sceneType: SceneType): ModelChoice {
  switch (sceneType) {
    case 'product_closeup':
      return { model: 'fal-ai/flux/schnell', reason: 'Fast, high quality for product close-ups' }
    case 'product_reveal':
      return { model: 'fal-ai/flux/schnell', reason: 'Character + product composition' }
    case 'talking_head':
      return { model: 'fal-ai/flux/schnell', reason: 'Character consistency for talking head' }
    case 'broll_lifestyle':
      return { model: 'fal-ai/flux/schnell', reason: 'Lifestyle scene generation' }
    default:
      return { model: 'fal-ai/flux/schnell', reason: 'Default image model' }
  }
}

export const CHARACTER_IMAGE_MODEL = 'fal-ai/flux/schnell'
export const COMPREHENSION_MODEL = 'gemini-2.5-pro'
export const CREATIVE_BRAIN_MODEL = 'gemini-2.5-flash'

// ── Video model selection ────────────────────────────────────────────────────

export type VideoModel = 'sora' | 'seedance-fast' | 'seedance-standard'

export async function selectVideoModel(): Promise<VideoModel> {
  const preferred = process.env.PREFERRED_VIDEO_MODEL
  if (preferred === 'seedance') return 'seedance-fast'
  if (preferred === 'seedance-standard') return 'seedance-standard'
  return 'sora'
}

export function getModelId(model: VideoModel): string {
  const models: Record<VideoModel, string> = {
    'sora': 'fal-ai/sora-2/image-to-video',
    'seedance-fast': 'bytedance/seedance-2.0/fast/image-to-video',
    'seedance-standard': 'bytedance/seedance-2.0/image-to-video',
  }
  return models[model]
}

export function getMaxDuration(model: VideoModel): number {
  // Sora supports 16s, Seedance max is 15s
  return model === 'sora' ? 16 : 15
}
