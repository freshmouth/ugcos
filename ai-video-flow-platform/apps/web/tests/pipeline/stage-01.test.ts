/**
 * Test: Stage 01 — Comprehension
 * Run: npx tsx tests/pipeline/stage-01.test.ts
 */

import { stage01Comprehension } from '../../lib/pipeline/stages/01-comprehension'
import type { PipelineOptions } from '../../lib/pipeline/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const mockProject = {
  id: 'test-project-id',
  user_id: 'test-user-id',
  name: 'TestProduct',
  product_description: 'A great test product',
  target_audience: 'millennials',
  product_category: null,
  content_types: ['informative'],
  posting_frequency: 'daily',
  posting_time: 'morning',
  metricool_brand_id: null,
  instagram_connected: true,
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

const mockOptions: PipelineOptions = {
  project: mockProject,
  userId: 'test-user-id',
  videoId: 'test-video-id',
  contentType: 'informative',
  triggeredBy: 'manual',
}

const mockSupabase = {} as SupabaseClient

async function runTests() {
  console.log('── Stage 01 Tests ──────────────────────────────')

  // Test 1: Default brief (no reference video)
  {
    const brief = await stage01Comprehension(mockOptions, mockSupabase)
    console.assert(brief.project_id === 'test-project-id', 'Should have project_id')
    console.assert(brief.content_type === 'informative', 'Should match content type')
    console.assert(brief.target_duration === 15, 'Target duration should be 15')
    console.assert(typeof brief.hook_type === 'string', 'Should have hook_type')
    console.assert(['slow', 'medium', 'fast'].includes(brief.pacing), 'Should have valid pacing')
    console.log('✓ Default brief shape is valid')
  }

  // Test 2: Different content types produce different hooks
  {
    const shockingOptions = { ...mockOptions, contentType: 'shocking' }
    const shockingBrief = await stage01Comprehension(shockingOptions, mockSupabase)
    console.assert(shockingBrief.hook_type === 'pattern_interrupt', 'Shocking should have pattern_interrupt hook')
    console.log('✓ Content type mapping works')
  }

  // Test 3: Unknown content type falls back gracefully
  {
    const unknownOptions = { ...mockOptions, contentType: 'unknown_type' }
    const brief = await stage01Comprehension(unknownOptions, mockSupabase)
    console.assert(brief.target_duration === 15, 'Unknown type should still have valid duration')
    console.log('✓ Unknown content type falls back gracefully')
  }

  console.log('── All Stage 01 tests passed ───────────────────')
}

runTests().catch(err => {
  console.error('Stage 01 tests FAILED:', err)
  process.exit(1)
})
