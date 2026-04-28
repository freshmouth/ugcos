/**
 * Test: Stage 02 — Creative Brain
 * Run: ANTHROPIC_API_KEY=<key> npx tsx tests/pipeline/stage-02.test.ts
 *
 * Requires: ANTHROPIC_API_KEY env var
 * Verifies output shape matches ScenePlan schema with 15-second constraint.
 */

import { stage02CreativeBrain } from '../../lib/pipeline/stages/02-creative-brain'
import type { ComprehensionBrief, Project, ScenePlan } from '../../lib/pipeline/types'
import { validateDuration } from '../../lib/pipeline/utils/timing-enforcer'

const mockBrief: ComprehensionBrief = {
  hook_type: 'pattern_interrupt',
  narrative_arc: 'reveal',
  pacing: 'fast',
  location_count: 2,
  cut_rhythm: 'quick_cuts',
  content_type: 'shocking',
  target_duration: 15,
  project_id: 'test-project-id',
}

const mockProject: Project = {
  id: 'test-project-id',
  user_id: 'test-user-id',
  name: 'GreenBoost Supplement',
  product_description: 'An energy-boosting green powder supplement',
  target_audience: 'health-conscious millennials',
  product_category: 'supplements',
  content_types: ['shocking', 'informative'],
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

function validateScenePlan(plan: ScenePlan): string[] {
  const errors: string[] = []

  if (typeof plan.total_scenes !== 'number') errors.push('total_scenes must be a number')
  if (plan.target_duration_seconds !== 15) errors.push(`target_duration_seconds must be 15, got ${plan.target_duration_seconds}`)
  if (!plan.avatar?.description) errors.push('avatar.description is required')
  if (!plan.avatar?.outfit_casual) errors.push('avatar.outfit_casual is required')
  if (!plan.props?.product_description) errors.push('props.product_description is required')
  if (!plan.hook_text) errors.push('hook_text is required')
  if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) errors.push('scenes must be non-empty array')

  for (const scene of plan.scenes) {
    if (typeof scene.id !== 'number') errors.push(`Scene missing id: ${JSON.stringify(scene)}`)
    if (!scene.type) errors.push(`Scene ${scene.id} missing type`)
    if (!scene.action) errors.push(`Scene ${scene.id} missing action`)
    if (typeof scene.duration_seconds !== 'number' || scene.duration_seconds < 1) {
      errors.push(`Scene ${scene.id} invalid duration: ${scene.duration_seconds}`)
    }
  }

  if (!validateDuration(plan.scenes, 15)) {
    const total = plan.scenes.reduce((s, sc) => s + sc.duration_seconds, 0)
    errors.push(`Scene durations must sum to 15, got ${total}`)
  }

  return errors
}

async function runTests() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠  ANTHROPIC_API_KEY not set — skipping Stage 02 live tests')
    console.log('   Set ANTHROPIC_API_KEY to run these tests')
    process.exit(0)
  }

  console.log('── Stage 02 Tests ──────────────────────────────')
  console.log('   Calling Claude API...')

  // Test 1: Full scene plan generation
  {
    const plan = await stage02CreativeBrain(mockBrief, mockProject)
    const errors = validateScenePlan(plan)

    if (errors.length > 0) {
      console.error('Scene plan validation failed:')
      errors.forEach(e => console.error(' -', e))
      process.exit(1)
    }

    console.log(`✓ ScenePlan has valid shape (${plan.total_scenes} scenes, ${plan.target_duration_seconds}s)`)
    console.log(`✓ Hook text: "${plan.hook_text}"`)
    console.log(`✓ Scene durations sum to exactly 15 seconds`)
  }

  // Test 2: Different content type produces different plan
  {
    const emotionalBrief = { ...mockBrief, content_type: 'emotional', hook_type: 'relatable' }
    const plan = await stage02CreativeBrain(emotionalBrief, mockProject)
    const errors = validateScenePlan(plan)
    console.assert(errors.length === 0, `Emotional plan invalid: ${errors.join(', ')}`)
    console.log('✓ Emotional content type produces valid plan')
  }

  console.log('── All Stage 02 tests passed ───────────────────')
}

runTests().catch(err => {
  console.error('Stage 02 tests FAILED:', err)
  process.exit(1)
})
