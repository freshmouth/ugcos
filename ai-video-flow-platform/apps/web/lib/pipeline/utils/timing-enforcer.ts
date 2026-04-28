import type { Scene } from '../types'

export function enforceExactDuration(
  scenes: Scene[],
  targetSeconds: number
): Scene[] {
  const total = scenes.reduce((sum, s) => sum + s.duration_seconds, 0)
  if (total === targetSeconds) return scenes

  const diff = targetSeconds - total
  const adjusted = [...scenes]

  if (diff > 0) {
    // Distribute extra seconds to the longest scenes
    adjusted.sort((a, b) => b.duration_seconds - a.duration_seconds)
    let remaining = diff
    for (let i = 0; i < adjusted.length && remaining > 0; i++) {
      const add = Math.min(remaining, 1)
      adjusted[i]!.duration_seconds += add
      remaining -= add
    }
  } else {
    // Remove from shortest scenes (minimum 1 second)
    adjusted.sort((a, b) => a.duration_seconds - b.duration_seconds)
    let remaining = Math.abs(diff)
    for (let i = 0; i < adjusted.length && remaining > 0; i++) {
      const scene = adjusted[i]!
      const canRemove = Math.min(remaining, scene.duration_seconds - 1)
      if (canRemove > 0) {
        scene.duration_seconds -= canRemove
        remaining -= canRemove
      }
    }
  }

  const newTotal = adjusted.reduce((sum, s) => sum + s.duration_seconds, 0)
  if (newTotal !== targetSeconds) {
    // Final correction on last scene
    const last = adjusted[adjusted.length - 1]!
    last.duration_seconds += targetSeconds - newTotal
  }

  // Restore original order
  return adjusted.sort((a, b) => a.id - b.id)
}

export function validateDuration(scenes: Scene[], targetSeconds: number): boolean {
  const total = scenes.reduce((sum, s) => sum + s.duration_seconds, 0)
  return total === targetSeconds
}
