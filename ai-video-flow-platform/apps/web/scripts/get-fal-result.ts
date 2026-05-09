// Run: cd apps/web && npx tsx --env-file .env.local scripts/get-fal-result.ts
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY })

const REQUEST_ID = '019de0d9-7d54-7b42-a99a-6c6cfae3f3f8'

const MODELS = [
  'fal-ai/sora-2/image-to-video',
  'bytedance/seedance-2.0/fast/image-to-video',
  'fal-ai/sora',
]

async function main() {
  console.log(`Fetching FAL result for request: ${REQUEST_ID}\n`)

  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model}`)
      const result = await fal.queue.result(model, { requestId: REQUEST_ID }) as { data?: { video?: { url: string }; url?: string } }
      const url = result?.data?.video?.url ?? result?.data?.url
      console.log(`✓ SUCCESS with ${model}`)
      console.log('Video URL:', url)
      console.log('Full result:', JSON.stringify(result, null, 2))
      process.exit(0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      console.log(`  ✗ ${msg.slice(0, 120)}`)
    }
  }

  // Try the status endpoint to see if it's still in queue
  for (const model of MODELS) {
    try {
      console.log(`\nChecking queue status for: ${model}`)
      const status = await fal.queue.status(model, { requestId: REQUEST_ID, logs: true })
      console.log('Status:', JSON.stringify(status, null, 2))
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      console.log(`  ✗ ${msg.slice(0, 120)}`)
    }
  }

  process.exit(1)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
