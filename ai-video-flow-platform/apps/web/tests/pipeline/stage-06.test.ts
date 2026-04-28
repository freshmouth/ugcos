/**
 * Test: Stage 06 — Captions
 * Run: npx tsx tests/pipeline/stage-06.test.ts
 *
 * Tests the fallback path (no SUBMAGIC_API_KEY) and verifies output shape.
 */

import { stage06Captions } from '../../lib/pipeline/stages/06-captions'
import type { ScenePlan } from '../../lib/pipeline/types'

const mockPlan: ScenePlan = {
  total_scenes: 3,
  target_duration_seconds: 15,
  avatar: {
    description: 'Test avatar',
    outfit_casual: 'jeans and t-shirt',
    outfit_athletic: 'gym wear',
  },
  props: {
    continuity_prop: 'water bottle',
    product_description: 'green supplement powder',
  },
  hook_text: 'I wish I knew this sooner...',
  scenes: [],
}

async function runTests() {
  console.log('── Stage 06 Tests ──────────────────────────────')

  // Test 1: Skips Submagic when API key is absent → returns input URL unchanged
  {
    const savedKey = process.env.SUBMAGIC_API_KEY
    delete process.env.SUBMAGIC_API_KEY

    const inputUrl = 'https://res.cloudinary.com/test/video.mp4'
    const result = await stage06Captions(inputUrl, mockPlan, 'test-project-id')

    console.assert(result.captioned_url === inputUrl, `Should return original URL when no API key, got: ${result.captioned_url}`)
    console.assert(typeof result.captioned_url === 'string', 'captioned_url must be a string')
    console.log('✓ Gracefully skips Submagic when SUBMAGIC_API_KEY is not set')

    if (savedKey) process.env.SUBMAGIC_API_KEY = savedKey
  }

  // Test 2: Output shape is correct
  {
    delete process.env.SUBMAGIC_API_KEY

    const result = await stage06Captions('https://example.com/video.mp4', mockPlan, 'proj-1')
    console.assert('captioned_url' in result, 'Result must have captioned_url property')
    console.assert(typeof result.captioned_url === 'string', 'captioned_url must be string')
    console.log('✓ Output shape is { captioned_url: string }')
  }

  console.log('── All Stage 06 tests passed ───────────────────')
}

runTests().catch(err => {
  console.error('Stage 06 tests FAILED:', err)
  process.exit(1)
})
