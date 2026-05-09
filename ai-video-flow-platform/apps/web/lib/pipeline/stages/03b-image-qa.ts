import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScenePlan, Project } from '../types'
import { generateImage, getProductFolder } from './03-image-generation'
import { getProductImage } from '../utils/cloudinary-references'

const DEFAULT_REFERENCE_FOLDER = 'catalog/sal-celtica/ugc-refs'

type ImageQAResult = {
  product_placement: number
  hand_realism: number
  face_quality: number
  background_realism: number
  ugc_authenticity: number
  overall_score: number
  verdict: 'PASS' | 'FAIL'
  issues: string[]
  fail_reason: string | null
}

const QA_PROMPT = `You are a quality control inspector for AI-generated UGC (user-generated content) product videos.

Analyze this image and score it 1-10 on each criterion. Then give an overall PASS or FAIL verdict.

Scoring criteria:

1. PRODUCT PLACEMENT (1-10)
   10 = product naturally held in hand or placed on surface
   1  = product floating in air, detached from hand, or superimposed awkwardly

2. HAND REALISM (1-10)
   10 = hands look completely natural, correct finger count
   1  = extra fingers, melted fingers, no visible hand holding the product

3. FACE QUALITY (1-10)
   10 = realistic natural face, normal skin
   1  = warped features, AI "pretty girl" look, waxy skin, weird eyes

4. BACKGROUND REALISM (1-10)
   10 = lived-in, authentic environment
   1  = fake-looking, CGI, studio backdrop

5. OVERALL UGC AUTHENTICITY (1-10)
   10 = looks like a real paused TikTok frame
   1  = obviously AI generated, polished, fake

PASS criteria: ALL scores >= 6 AND no single score below 5
FAIL criteria: ANY score below 5

Return JSON only:
{
  "product_placement": 7,
  "hand_realism": 6,
  "face_quality": 8,
  "background_realism": 7,
  "ugc_authenticity": 7,
  "overall_score": 7.0,
  "verdict": "PASS",
  "issues": [],
  "fail_reason": null
}

For FAIL, issues array should list specific problems like:
  "floating product - bag not connected to hand"
  "extra fingers on left hand"
  "waxy AI skin texture"
  "studio lighting not authentic"`

function buildFixedPrompt(basePrompt: string, issues: string[]): string {
  let fixed = basePrompt
  const lower = issues.map(i => i.toLowerCase()).join(' ')

  if (lower.includes('floating') || lower.includes('not connected') || lower.includes('detached')) {
    fixed += ' CRITICAL: The product MUST be physically held in the person\'s hand with fingers wrapped around it naturally. The product cannot float or be superimposed. Show a firm natural grip.'
  }
  if (lower.includes('finger') || lower.includes('hand')) {
    fixed += ' CRITICAL: Hands must have exactly 5 fingers each. Keep hands below chest level and away from the camera lens.'
  }
  if (lower.includes('waxy') || lower.includes('skin') || lower.includes('smooth')) {
    fixed += ' CRITICAL: Skin must look real with natural texture, pores visible, no beauty filter, no AI smoothing.'
  }
  if (lower.includes('studio') || lower.includes('lighting') || lower.includes('backdrop')) {
    fixed += ' CRITICAL: Natural window light only, uneven and slightly imperfect. No professional lighting setup.'
  }
  if (lower.includes('face') || lower.includes('warp') || lower.includes('eyes')) {
    fixed += ' CRITICAL: Face must be natural with realistic asymmetry. No perfect symmetry, no AI-generated facial features.'
  }

  return fixed
}

async function runImageQA(image_url: string): Promise<ImageQAResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: image_url, detail: 'high' } },
        { type: 'text', text: QA_PROMPT },
      ],
    }],
  })

  const text = response.choices[0]?.message?.content?.trim() ?? '{}'
  const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(jsonStr) as ImageQAResult
}

async function qaWithRetry(
  image_url: string,
  adaptedPrompt: string,
  productImageUrl: string,
  project: Project,
  videoId: string,
  attempt: number
): Promise<{ image_url: string; qa: ImageQAResult }> {
  const qa = await runImageQA(image_url)
  const scores = `product:${qa.product_placement} hand:${qa.hand_realism} face:${qa.face_quality} bg:${qa.background_realism} ugc:${qa.ugc_authenticity}`
  console.log(`[IMAGE-QA] Score: ${qa.overall_score}/10 — ${qa.verdict} (${scores})`)

  if (qa.verdict === 'PASS') return { image_url, qa }

  console.log(`[IMAGE-QA] FAILED: ${qa.fail_reason} | issues: ${qa.issues.join(', ')}`)

  if (attempt >= 2) {
    console.warn('[IMAGE-QA] Max retries reached — using best available image')
    return { image_url, qa }
  }

  console.log(`[IMAGE-QA] Retrying image generation (attempt ${attempt + 2}/3)...`)
  const fixedPrompt = buildFixedPrompt(adaptedPrompt, qa.issues)

  const result = await generateImage({
    project,
    videoId,
    productImageUrl,
    referenceFolder: project.cloudinary_folder ?? DEFAULT_REFERENCE_FOLDER,
    promptOverride: fixedPrompt,
  })

  return qaWithRetry(result.image_url, result.adaptedPrompt, productImageUrl, project, videoId, attempt + 1)
}

export async function stage03bImageQA(
  plan: ScenePlan,
  project: Project,
  supabase: SupabaseClient,
  videoId: string
): Promise<ScenePlan> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[IMAGE-QA] OPENAI_API_KEY not set — skipping image QA')
    return plan
  }

  const referenceFolder = project.cloudinary_folder ?? DEFAULT_REFERENCE_FOLDER
  const productFolder = getProductFolder(referenceFolder)

  let productImageUrl: string
  try {
    productImageUrl = await getProductImage(productFolder)
  } catch {
    console.warn('[IMAGE-QA] Could not fetch product image — skipping image QA')
    return plan
  }

  let overallQaScore: number | null = null
  let overallQaData: ImageQAResult | null = null

  const updatedScenes = await Promise.all(
    plan.scenes.map(async scene => {
      if (!scene.image_url) return scene

      try {
        const { image_url: finalUrl, qa } = await qaWithRetry(
          scene.image_url,
          '',
          productImageUrl,
          project,
          videoId,
          0
        )
        overallQaScore = qa.overall_score
        overallQaData = qa
        return { ...scene, image_url: finalUrl }
      } catch (err) {
        console.warn(`[IMAGE-QA] QA failed for scene ${scene.id}:`, err instanceof Error ? err.message : String(err))
        return scene
      }
    })
  )

  if (overallQaScore !== null) {
    const qaData = overallQaData as unknown as ImageQAResult
    console.log(`[QA] Image score: ${overallQaScore}/10 ${qaData.verdict}`)
    await supabase.from('videos').update({
      qa_image_score: overallQaScore,
      qa_image_data: qaData,
    }).eq('id', videoId)
  }

  return { ...plan, scenes: updatedScenes }
}
