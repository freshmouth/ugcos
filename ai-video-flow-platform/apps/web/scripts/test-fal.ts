// Run: cd apps/web && npx tsx --env-file .env.local scripts/test-fal.ts
// Stages: 1=image, 2=video (set TEST_VIDEO=1 to enable stage 2)
// Reset: rm /tmp/test-fal.checkpoint.json
import { fal } from '@fal-ai/client'
import * as fs from 'fs'

fal.config({ credentials: process.env.FAL_KEY })

const CHECKPOINT = '/tmp/test-fal.checkpoint.json'

type Checkpoint = { image_done?: boolean; image_url?: string; video_done?: boolean }

function loadCheckpoint(): Checkpoint {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) } catch { return {} }
}

function saveCheckpoint(data: Checkpoint) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(data))
}

async function main() {
  console.log('Testing FAL AI connection...')
  console.log('FAL_KEY present:', Boolean(process.env.FAL_KEY))

  const cp = loadCheckpoint()

  // Stage 1: Image generation
  if (!cp.image_done) {
    console.log('\n[STAGE 1] Image generation (fal-ai/flux/schnell)...')
    const imgResult = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt: 'A woman holding a skincare bottle, studio lighting, vertical portrait',
        image_size: { width: 576, height: 1024 },
        num_inference_steps: 4,
      },
    }) as { data?: { images?: Array<{ url: string }> }; images?: Array<{ url: string }> }

    const imgUrl = imgResult?.data?.images?.[0]?.url ?? imgResult?.images?.[0]?.url
    if (!imgUrl) {
      console.error('✗ No image URL. Full result:', JSON.stringify(imgResult, null, 2).slice(0, 500))
      process.exit(1)
    }
    console.log('✓ Image generated:', imgUrl)
    saveCheckpoint({ image_done: true, image_url: imgUrl })
    console.log('\nStage 1 complete — re-run to proceed to Stage 2 (set TEST_VIDEO=1 to run video).')
    process.exit(0)
  }

  console.log('[STAGE 1] image — skipped (checkpoint)')

  // Stage 2: Video generation — one call, no fallback
  if (process.env.TEST_VIDEO !== '1') {
    console.log('\n[STAGE 2] Video model — skipped (set TEST_VIDEO=1 to enable)')
    console.log('\nFAL test complete. Run: rm', CHECKPOINT, 'to reset.')
    process.exit(0)
  }

  if (!cp.video_done) {
    console.log('\n[STAGE 2] Video model (fal-ai/seedance-v1/image-to-video)...')
    const vidResult = await fal.subscribe('fal-ai/seedance-v1/image-to-video', {
      input: {
        image_url: cp.image_url ?? 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=576&h=1024&fit=crop',
        prompt: 'Person walking forward, natural movement',
        duration: 2,
        aspect_ratio: '9:16',
      },
    }) as { video?: { url: string }; video_url?: string }

    const vidUrl = vidResult?.video?.url ?? vidResult?.video_url
    if (!vidUrl) {
      console.error('✗ No video URL returned')
      process.exit(1)
    }
    console.log('✓ Video generated:', vidUrl)
    saveCheckpoint({ ...cp, video_done: true })
    console.log('\nStage 2 complete.')
    process.exit(0)
  }

  console.log('[STAGE 2] video — skipped (checkpoint)')
  console.log('\nAll stages complete. Run: rm', CHECKPOINT, 'to reset.')
  process.exit(0)
}

main().catch(err => {
  console.error('\n✗ Unhandled error:', err)
  process.exit(1)
})
