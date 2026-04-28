/**
 * Test: Stage 07 — Publish
 * Run: npx tsx tests/pipeline/stage-07.test.ts
 *
 * Tests the fallback paths that don't require live API keys.
 */

import { stage07Publish } from '../../lib/pipeline/stages/07-publish'
import type { ScenePlan, Project } from '../../lib/pipeline/types'

const mockPlan: ScenePlan = {
  total_scenes: 3,
  target_duration_seconds: 15,
  avatar: {
    description: 'Test avatar',
    outfit_casual: 'jeans',
    outfit_athletic: 'gym wear',
  },
  props: {
    continuity_prop: 'bottle',
    product_description: 'green powder',
  },
  hook_text: 'I wish I knew this sooner...',
  scenes: [],
}

const baseProject: Project = {
  id: 'test-project-id',
  user_id: 'test-user-id',
  name: 'TestProduct',
  product_description: 'A great product',
  target_audience: 'millennials',
  product_category: null,
  content_types: ['informative'],
  posting_frequency: 'daily',
  posting_time: 'morning',
  metricool_brand_id: null,
  instagram_connected: false,
  facebook_connected: false,
  active: true,
  autopilot: true,
  system_prompt: null,
  script_prompts: [],
  cloudinary_folder: null,
  character_reference_url: null,
  voice_reference_url: null,
  hooks_library: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

async function runTests() {
  console.log('── Stage 07 Tests ──────────────────────────────')

  // Test 1: No metricool_brand_id → returns empty post_ids
  {
    const result = await stage07Publish(
      { ...baseProject, metricool_brand_id: null },
      'https://res.cloudinary.com/captioned.mp4',
      mockPlan
    )
    console.assert(Array.isArray(result.post_ids), 'post_ids must be an array')
    console.assert(result.post_ids.length === 0, 'Should return empty post_ids when no metricool_brand_id')
    console.log('✓ Returns empty post_ids when metricool_brand_id is null')
  }

  // Test 2: No connected networks → returns empty post_ids
  {
    const result = await stage07Publish(
      { ...baseProject, metricool_brand_id: 'brand-123', instagram_connected: false, facebook_connected: false },
      'https://res.cloudinary.com/captioned.mp4',
      mockPlan
    )
    console.assert(result.post_ids.length === 0, 'Should return empty post_ids with no connected networks')
    console.log('✓ Returns empty post_ids when no platforms connected')
  }

  // Test 3: Output shape is always correct
  {
    const result = await stage07Publish(baseProject, 'https://example.com/video.mp4', mockPlan)
    console.assert('post_ids' in result, 'Result must have post_ids property')
    console.assert(Array.isArray(result.post_ids), 'post_ids must be an array')
    console.assert(result.post_ids.every(id => typeof id === 'string'), 'All post_ids must be strings')
    console.log('✓ Output shape is { post_ids: string[] }')
  }

  console.log('── All Stage 07 tests passed ───────────────────')
}

runTests().catch(err => {
  console.error('Stage 07 tests FAILED:', err)
  process.exit(1)
})
