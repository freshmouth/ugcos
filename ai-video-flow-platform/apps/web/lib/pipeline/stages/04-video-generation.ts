import { fal } from '@fal-ai/client'
import type { ScenePlan, Scene } from '../types'
import { VIDEO_MODEL } from '../utils/model-router'
import { withRetry } from '../utils/retry'

fal.config({ credentials: process.env.FAL_KEY })

type FalVideoResult = {
  video?: { url: string }
  video_url?: string
}

export async function stage04VideoGeneration(plan: ScenePlan): Promise<ScenePlan> {
  const scenes = plan.scenes
  const mid = Math.ceil(scenes.length / 2)
  const run1 = scenes.slice(0, mid)
  const run2 = scenes.slice(mid)

  const [results1, results2] = await Promise.all([
    generateBatch(run1),
    generateBatch(run2),
  ])

  const allResults = [...results1, ...results2]
  const failedCount = allResults.filter(r => r.error).length

  if (failedCount > 2) {
    throw new Error(`Too many scene generation failures: ${failedCount}/${scenes.length}`)
  }

  const sceneMap = new Map<number, { clip_url?: string; error?: string }>()
  scenes.forEach((scene, i) => sceneMap.set(scene.id, allResults[i]!))

  return {
    ...plan,
    scenes: plan.scenes.map(scene => ({
      ...scene,
      clip_url: sceneMap.get(scene.id)?.clip_url,
    })),
  }
}

async function generateBatch(
  scenes: Scene[]
): Promise<Array<{ clip_url?: string; error?: string }>> {
  return Promise.all(scenes.map(scene => generateSceneClip(scene)))
}

async function generateSceneClip(
  scene: Scene
): Promise<{ clip_url?: string; error?: string }> {
  if (!scene.image_url) {
    return { error: `Scene ${scene.id} has no image_url` }
  }

  try {
    const clip_url = await withRetry(async () => {
      const result = await fal.subscribe(VIDEO_MODEL, {
        input: {
          image_url: scene.image_url,
          prompt: `${scene.action} ${scene.motion}`.trim(),
          duration: scene.duration_seconds,
          aspect_ratio: '9:16',
          resolution: '1080p',
        },
      }) as FalVideoResult

      const url = result?.video?.url ?? result?.video_url
      if (!url) throw new Error(`Scene ${scene.id} video generation returned no URL`)
      return url
    }, 2, 2000)

    return { clip_url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
