/**
 * Test: Pipeline Utilities
 * Run: npx tsx tests/pipeline/stage-utils.test.ts
 */

import { enforceExactDuration, validateDuration } from '../../lib/pipeline/utils/timing-enforcer'
import { withRetry, sleep } from '../../lib/pipeline/utils/retry'
import type { Scene } from '../../lib/pipeline/types'

function makeScenes(durations: number[]): Scene[] {
  return durations.map((d, i) => ({
    id: i + 1,
    type: 'talking_head' as const,
    location: 'test',
    outfit: 'casual' as const,
    duration_seconds: d,
    camera: 'medium shot',
    action: 'speaking',
    background: 'office',
    show_product: false,
    motion: 'steady',
    caption: 'Test caption',
  }))
}

async function runTests() {
  console.log('── Timing Enforcer Tests ───────────────────────')

  // Test 1: Scenes already match target
  {
    const scenes = makeScenes([2, 3, 2, 3, 2, 3])
    const result = enforceExactDuration(scenes, 15)
    console.assert(validateDuration(result, 15), 'Already correct duration should pass')
    console.log('✓ No adjustment needed when durations already sum to target')
  }

  // Test 2: Scenes total less than target
  {
    const scenes = makeScenes([2, 2, 2, 2, 2])
    const result = enforceExactDuration(scenes, 15)
    const total = result.reduce((s, sc) => s + sc.duration_seconds, 0)
    console.assert(total === 15, `Should adjust to 15, got ${total}`)
    console.log('✓ Under-duration corrected')
  }

  // Test 3: Scenes total more than target
  {
    const scenes = makeScenes([3, 3, 3, 3, 3, 3, 3])
    const result = enforceExactDuration(scenes, 15)
    const total = result.reduce((s, sc) => s + sc.duration_seconds, 0)
    console.assert(total === 15, `Should adjust to 15, got ${total}`)
    result.forEach(s => console.assert(s.duration_seconds >= 1, `Scene ${s.id} duration must be >= 1`))
    console.log('✓ Over-duration corrected, no scene < 1 second')
  }

  // Test 4: Scene order preserved
  {
    const scenes = makeScenes([2, 2, 2, 2, 2])
    const result = enforceExactDuration(scenes, 15)
    result.forEach((s, i) => console.assert(s.id === i + 1, `Scene ${i + 1} id mismatch`))
    console.log('✓ Scene order preserved after adjustment')
  }

  console.log('── Retry Utility Tests ─────────────────────────')

  // Test 5: withRetry succeeds on first attempt
  {
    let calls = 0
    const result = await withRetry(async () => { calls++; return 'ok' }, 3)
    console.assert(result === 'ok', 'Should return result')
    console.assert(calls === 1, 'Should only call once on success')
    console.log('✓ withRetry succeeds on first attempt')
  }

  // Test 6: withRetry retries on failure
  {
    let calls = 0
    const result = await withRetry(async () => {
      calls++
      if (calls < 2) throw new Error('fail')
      return 'ok'
    }, 3, 10)
    console.assert(result === 'ok', 'Should eventually succeed')
    console.assert(calls === 2, `Should call 2 times, got ${calls}`)
    console.log('✓ withRetry retries on failure')
  }

  // Test 7: withRetry throws after max attempts
  {
    let threw = false
    try {
      await withRetry(async () => { throw new Error('always fails') }, 2, 10)
    } catch {
      threw = true
    }
    console.assert(threw, 'Should throw after max attempts')
    console.log('✓ withRetry throws after max attempts')
  }

  console.log('── All utility tests passed ────────────────────')
}

runTests().catch(err => {
  console.error('Utility tests FAILED:', err)
  process.exit(1)
})
