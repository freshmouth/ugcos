// Run: cd apps/web && npx tsx --env-file .env.local scripts/test-image-generation.ts
// Runs one stage per execution. Re-run to advance to the next stage.
import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'
import { fal } from '@fal-ai/client'
import { getRandomReferenceImage, getProductImage } from '../lib/pipeline/utils/cloudinary-references'
import { MASTER_UGC_PROMPT, SAL_CELTICA_PRODUCT } from '../lib/pipeline/prompts/master-ugc-prompt'
import { SORA_VIDEO_ENGINE_SYSTEM_PROMPT, SORA_PROMPT_LOCK } from '../lib/pipeline/prompts/sora-video-prompt'
import { SEEDANCE_VIDEO_ENGINE_SYSTEM_PROMPT, SEEDANCE_PROMPT_LOCK } from '../lib/pipeline/prompts/seedance-video-prompt'
import { selectVideoModel, getModelId, getMaxDuration } from '../lib/pipeline/utils/model-router'

fal.config({ credentials: process.env.FAL_KEY })

const CHECKPOINT_FILE = path.join(process.cwd(), 'scripts', '.image-gen-checkpoint.json')
const REFERENCE_FOLDER = 'catalog/sal-celtica/ugc-refs'
const PRODUCT_FOLDER = 'catalog/sal-celtica/products'

type Checkpoint = {
  stage: 1 | 2 | 3 | 4 | 5
  referenceImageUrl?: string
  productImageUrl?: string
  adaptedPrompt?: string
  generatedImageUrl?: string
  soraPrompt?: string
  videoPrompt?: string
  videoUrl?: string
}

function loadCheckpoint(): Checkpoint {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf-8')) as Checkpoint
    }
  } catch { /* fresh start */ }
  return { stage: 1 }
}

function saveCheckpoint(cp: Checkpoint) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2))
  console.log(`\n✓ Checkpoint saved (stage ${cp.stage} complete)`)
}

async function main() {
  const cp = loadCheckpoint()
  console.log(`=== Image Generation Test — starting at stage ${cp.stage} ===\n`)

  // ── STAGE 1: Select reference image + product image from Cloudinary ──────
  if (cp.stage === 1) {
    console.log('STAGE 1 — Fetching reference + product images from Cloudinary')

    console.log('\n[REF] Listing', REFERENCE_FOLDER)
    const referenceImageUrl = await getRandomReferenceImage(REFERENCE_FOLDER)
    console.log('[REF] Selected:', referenceImageUrl)

    console.log('\n[PRODUCT] Listing', PRODUCT_FOLDER)
    const productImageUrl = await getProductImage(PRODUCT_FOLDER)
    console.log('[PRODUCT] Found image:', productImageUrl)

    saveCheckpoint({ ...cp, stage: 2, referenceImageUrl, productImageUrl })
    console.log('\nRe-run this script to proceed to Stage 2 (GPT-4o prompt adaptation).')
    process.exit(0)
  }

  // ── STAGE 2: Adapt master prompt with GPT-4o ─────────────────────────────
  if (cp.stage === 2) {
    if (!cp.referenceImageUrl) { console.error('Missing referenceImageUrl in checkpoint'); process.exit(1) }
    if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1) }

    console.log('STAGE 2 — Adapting master prompt with GPT-4o...')
    console.log('Reference image:', cp.referenceImageUrl)

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: cp.referenceImageUrl, detail: 'high' } },
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
Replace [PRODUCT] with: "${SAL_CELTICA_PRODUCT}".

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
      }],
    })

    const adaptedPrompt = res.choices[0]?.message?.content?.trim()
      || MASTER_UGC_PROMPT.replace(/\[PRODUCT\]/g, SAL_CELTICA_PRODUCT)

    console.log('\n[PROMPT] Adapted prompt:\n', adaptedPrompt)

    saveCheckpoint({ ...cp, stage: 3, adaptedPrompt })
    console.log('\nRe-run this script to proceed to Stage 3 (FAL image generation).')
    process.exit(0)
  }

  // ── STAGE 3: Generate image with FAL GPT Image 2 ─────────────────────────
  if (cp.stage === 3) {
    if (!cp.adaptedPrompt) { console.error('Missing adaptedPrompt in checkpoint'); process.exit(1) }
    if (!cp.productImageUrl) { console.error('Missing productImageUrl in checkpoint'); process.exit(1) }

    console.log('STAGE 3 — Generating image with fal-ai/openai/gpt-image-2/edit...')
    console.log('Product image:', cp.productImageUrl)
    console.log('Prompt (first 200 chars):', cp.adaptedPrompt.slice(0, 200) + '...')

    const finalPrompt = `CRITICAL: The product packaging in the provided image must appear EXACTLY as shown — same colors, same design, same labels. Do not substitute or simplify the packaging. ${cp.adaptedPrompt}`

    type FalResult = { data?: { images?: Array<{ url: string }> }; images?: Array<{ url: string }> }
    const result = await fal.subscribe('openai/gpt-image-2/edit', {
      input: {
        prompt: finalPrompt,
        image_urls: [cp.productImageUrl],
        image_size: { width: 1080, height: 1920 },
        quality: 'medium',
        num_images: 1,
      },
    }) as FalResult

    const generatedImageUrl = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url
    if (!generatedImageUrl) {
      console.error('FAL returned no image URL. Full response:', JSON.stringify(result).slice(0, 500))
      process.exit(1)
    }

    console.log('\n[IMAGE] Generated:', generatedImageUrl)
    saveCheckpoint({ ...cp, stage: 4, generatedImageUrl })

    console.log('\nRe-run this script to proceed to Stage 4 (Sora prompt generation).')
    process.exit(0)
  }

  // ── STAGE 4: Generate video prompt with GPT-4o (model-aware) ────────────
  if (cp.stage === 4) {
    if (!cp.generatedImageUrl) { console.error('Missing generatedImageUrl in checkpoint'); process.exit(1) }
    if (!process.env.OPENAI_API_KEY) { console.error('OPENAI_API_KEY not set'); process.exit(1) }

    const model = await selectVideoModel()
    const modelId = getModelId(model)
    const duration = getMaxDuration(model)
    const isSora = model === 'sora'

    console.log(`[VIDEO MODEL] ${model} | ${duration}s`)
    console.log(`STAGE 4 — Generating ${model} prompt with GPT-4o...`)
    console.log('Generated image:', cp.generatedImageUrl)

    const systemPrompt = isSora ? SORA_VIDEO_ENGINE_SYSTEM_PROMPT : SEEDANCE_VIDEO_ENGINE_SYSTEM_PROMPT
    const promptLock = isSora ? SORA_PROMPT_LOCK : SEEDANCE_PROMPT_LOCK

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create a ${isSora ? 'Sora 2 Pro' : 'Seedance 2.0'} video prompt for this product video:

Product: Sal Céltica Marina Fina — a premium sea salt from Brittany, France.
Rich in 82 essential minerals. Unrefined, sun-dried, naturally harvested.
Target audience: health-conscious women 25-40 in Mexico and Latin America.
Content type: Scroll Stopper
Duration: ${duration} seconds
Language: Spanish (native Mexican/LATAM cadence)
Model: ${isSora ? 'Sora 2 — descriptive atmospheric prompts' : 'Seedance 2.0 — shot list cinematic direction'}

The video should start from this generated image:
${cp.generatedImageUrl}

The talent is already in scene with the product.
Make it feel like an accidentally captured real TikTok moment.

${promptLock}`,
        },
      ],
    })

    const videoPrompt = res.choices[0]?.message?.content?.trim()
    if (!videoPrompt) { console.error(`GPT-4o returned empty ${model} prompt`); process.exit(1) }

    console.log(`\n[${model.toUpperCase()}-PROMPT] Generated prompt:\n`)
    console.log(videoPrompt)

    saveCheckpoint({ ...cp, stage: 5, soraPrompt: videoPrompt, videoPrompt })
    console.log(`\nStage 4 ${model} prompt generated. Run again for Stage 5 (${modelId}).`)
    process.exit(0)
  }

  // ── STAGE 5: Generate video with selected model ───────────────────────────
  if (cp.stage === 5) {
    const prompt = cp.videoPrompt ?? cp.soraPrompt
    if (!prompt) { console.error('Missing video prompt in checkpoint'); process.exit(1) }
    if (!cp.generatedImageUrl) { console.error('Missing generatedImageUrl in checkpoint'); process.exit(1) }

    const model = await selectVideoModel()
    const modelId = getModelId(model)
    const duration = getMaxDuration(model)
    const isSora = model === 'sora'

    console.log(`[VIDEO MODEL] ${model} | ${duration}s`)
    console.log(`STAGE 5 — Generating video with ${modelId}...`)
    console.log('Image URL:', cp.generatedImageUrl)
    console.log('Prompt (first 300 chars):', prompt.slice(0, 300) + '...')

    type FalVideoResult = { data?: { video?: { url: string }; url?: string } }

    const falInput: Record<string, unknown> = {
      prompt,
      image_url: cp.generatedImageUrl,
      duration: String(duration),
      aspect_ratio: '9:16',
      resolution: '720p',
    }
    if (!isSora) {
      falInput.generate_audio = true
    }

    const result = await fal.subscribe(modelId, {
      input: falInput,
      logs: true,
      onQueueUpdate: (update: { status: string; logs?: Array<{ message: string }> }) => {
        console.log(`[${model.toUpperCase()}] Status:`, update.status)
        if (update.logs) update.logs.map(l => l.message).forEach(m => console.log(`[${model.toUpperCase()}]`, m))
      },
    }) as FalVideoResult

    const videoUrl = result?.data?.video?.url ?? result?.data?.url
    if (!videoUrl) {
      console.error(`${model} returned no video URL. Full response:`, JSON.stringify(result).slice(0, 500))
      process.exit(1)
    }

    console.log('\n[VIDEO] Generated:', videoUrl)
    saveCheckpoint({ ...cp, videoUrl })

    console.log('\n=== SUCCESS — all 5 stages complete ===')
    console.log('Generated video URL:', videoUrl)
    console.log('\nDelete scripts/.image-gen-checkpoint.json to start fresh.')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('\n❌ Unhandled error:', err)
  if (err && typeof err === 'object' && 'body' in err) {
    console.error('Full error body:', JSON.stringify((err as { body: unknown }).body, null, 2))
  }
  process.exit(1)
})
