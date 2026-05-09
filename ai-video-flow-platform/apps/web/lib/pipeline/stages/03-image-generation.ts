import OpenAI from 'openai'
import { fal } from '@fal-ai/client'
import type { ScenePlan, Project } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getRandomReferenceImage, getProductImage } from '../utils/cloudinary-references'
import { MASTER_UGC_PROMPT, SAL_CELTICA_PRODUCT } from '../prompts/master-ugc-prompt'

fal.config({ credentials: process.env.FAL_KEY })

const DEFAULT_REFERENCE_FOLDER = 'catalog/sal-celtica/ugc-refs'
const GPT_IMAGE_MODEL = 'openai/gpt-image-2/edit'


type FalImageResult = {
  data?: { images?: Array<{ url: string }> }
  images?: Array<{ url: string }>
}

export async function stage03ImageGeneration(
  plan: ScenePlan,
  project: Project,
  supabase: SupabaseClient,
  videoId: string
): Promise<ScenePlan> {
  const referenceFolder = project.cloudinary_folder ?? DEFAULT_REFERENCE_FOLDER
  const productFolder = getProductFolder(referenceFolder)

  try {
    const productImageUrl = await getProductImage(productFolder)
    const { image_url } = await generateImage({ project, videoId, productImageUrl, referenceFolder })

    await supabase
      .from('videos')
      .update({ fal_image_url: image_url })
      .eq('id', videoId)

    return {
      ...plan,
      scenes: plan.scenes.map(scene => ({ ...scene, image_url })),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[IMAGE-GEN] Stage 3 failed, continuing without images: ${msg}`)
    return plan
  }
}

export async function generateImage(options: {
  project: Project
  videoId: string
  productImageUrl: string
  referenceFolder?: string
  promptOverride?: string
}): Promise<{ image_url: string; referenceImageUrl: string; adaptedPrompt: string }> {
  const referenceFolder = options.referenceFolder ?? options.project.cloudinary_folder ?? DEFAULT_REFERENCE_FOLDER
  // Step 1: Random reference image from Cloudinary
  console.log(`[IMAGE-GEN] Step 1: Fetching reference image from ${referenceFolder}...`)
  const referenceImageUrl = await getRandomReferenceImage(referenceFolder)
  console.log('[IMAGE-GEN] Step 1 ✓ Reference:', referenceImageUrl)

  // Step 2: Adapt master prompt — skip GPT-4o if a fixed prompt is provided (QA retry)
  let adaptedPrompt: string
  if (options.promptOverride) {
    adaptedPrompt = options.promptOverride
    console.log('[IMAGE-GEN] Step 2 ✓ Using QA-fixed prompt')
  } else {
    console.log('[IMAGE-GEN] Step 2: Adapting prompt with GPT-4o...')
    const productDesc = options.project.product_description ?? SAL_CELTICA_PRODUCT
    adaptedPrompt = await adaptPromptWithOpenAI(referenceImageUrl, productDesc)
    console.log('[IMAGE-GEN] Step 2 ✓ Adapted prompt:', adaptedPrompt.slice(0, 150) + '...')
  }

  // Step 3: Generate with FAL GPT Image 2 (product image → fal.ai only, never Claude)
  console.log('[IMAGE-GEN] Step 3: Generating image with fal-ai/openai/gpt-image-2/edit...')
  const image_url = await generateWithFalGPTImage2(adaptedPrompt, options.productImageUrl)
  console.log('[IMAGE-GEN] Step 3 ✓ Generated:', image_url)

  return { image_url, referenceImageUrl, adaptedPrompt }
}

export function getProductFolder(referenceFolder: string): string {
  const parts = referenceFolder.split('/')
  if (parts.length >= 2) {
    parts[parts.length - 1] = 'products'
    return parts.join('/')
  }
  return 'catalog/sal-celtica/products'
}

async function adaptPromptWithOpenAI(referenceImageUrl: string, productDesc: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: referenceImageUrl, detail: 'high' },
          },
          {
            type: 'text',
            text: `You are a prompt engineer for AI image generation.

Analyze the aesthetic of this UGC reference image carefully:
- What is the environment/setting?
- What is the lighting like?
- What is the framing/composition?
- What is the woman's expression and pose?
- What is the overall mood and authenticity level?

Now adapt the master prompt below to match this specific aesthetic.
Replace [PRODUCT] with: "${productDesc}".

Keep all the realism instructions. Only adapt:
- The specific environment (match the reference image exactly)
- The lighting description (match the reference image)
- The framing/composition style (match the reference image)
- The expression/pose (match the reference image)

Output ONLY the final adapted prompt. No explanation. No preamble.
No markdown. Just the raw prompt text ready for fal.ai.

MASTER PROMPT:
${MASTER_UGC_PROMPT}`,
          },
        ],
      },
    ],
  })

  const text = response.choices[0]?.message?.content?.trim() ?? ''

  if (!text) {
    console.warn('[IMAGE-GEN] GPT-4o returned empty response, using master prompt directly')
    return MASTER_UGC_PROMPT.replace(/\[PRODUCT\]/g, productDesc)
  }

  return text
}

async function generateWithFalGPTImage2(prompt: string, productImageUrl: string): Promise<string> {
  const finalPrompt = `CRITICAL: The product packaging in the provided image must appear EXACTLY as shown — same colors, same design, same labels. Do not substitute or simplify the packaging. ${prompt}`

  const result = await fal.subscribe(GPT_IMAGE_MODEL, {
    input: {
      prompt: finalPrompt,
      image_urls: [productImageUrl],
      image_size: { width: 1080, height: 1920 },
      quality: 'medium',
      num_images: 1,
    },
  }) as FalImageResult

  const url = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url
  if (!url) throw new Error('GPT Image 2 returned no image URL')
  return url
}
