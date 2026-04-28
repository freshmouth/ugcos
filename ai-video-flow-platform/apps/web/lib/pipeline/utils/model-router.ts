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

export const VIDEO_MODEL = 'fal-ai/seedance-v2'
export const CHARACTER_IMAGE_MODEL = 'fal-ai/flux/schnell'
export const COMPREHENSION_MODEL = 'gemini-2.5-pro'
export const CREATIVE_BRAIN_MODEL = 'claude-sonnet-4-6'
