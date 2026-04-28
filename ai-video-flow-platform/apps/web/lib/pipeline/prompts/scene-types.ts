import type { SceneType } from '../types'

export const SCENE_PROMPTS: Record<SceneType, string> = {
  talking_head:
    'Person speaking directly to camera, natural hand gestures, genuine expression, {action}, handheld feel, depth of field background blur, warm natural light, authentic UGC aesthetic',

  product_reveal:
    'Person holding {product} up to camera at chest height, product label clearly visible and readable, slight smile, natural light, {product_description}, excited authentic reaction, close crop on product and face',

  broll_lifestyle:
    'Cinematic b-roll, {location}, natural motion, warm color grade, no people in focus, lifestyle aesthetic, golden hour light if outdoor',

  product_closeup:
    'Product {product_name} isolated on {surface}, soft natural lighting, macro lens feel, clean background, product hero shot, sharp focus on label',

  broll_stock:
    '{broll_source} related footage, cinematic, smooth motion, professional quality, 9:16 vertical crop',
}

export function buildScenePrompt(
  type: SceneType,
  substitutions: Record<string, string>
): string {
  let prompt = SCENE_PROMPTS[type]
  for (const [key, value] of Object.entries(substitutions)) {
    prompt = prompt.replace(`{${key}}`, value)
  }
  return prompt
}
