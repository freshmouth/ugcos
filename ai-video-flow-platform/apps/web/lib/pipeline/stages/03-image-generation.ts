import { fal } from '@fal-ai/client'
import type { ScenePlan, Scene, Project } from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CHARACTER_IMAGE_MODEL, selectImageModel } from '../utils/model-router'
import { buildCharacterPrompt, buildConsistencyNote, DEFAULT_CHARACTER } from '../prompts/character-consistency'
import { buildScenePrompt } from '../prompts/scene-types'
import { withRetry } from '../utils/retry'

fal.config({ credentials: process.env.FAL_KEY })

export async function stage03ImageGeneration(
  plan: ScenePlan,
  project: Project,
  supabase: SupabaseClient
): Promise<ScenePlan> {
  // Generate or reuse master character image
  let characterUrl = project.character_reference_url
  if (!characterUrl) {
    characterUrl = await generateCharacterImage(plan, project)
    await supabase
      .from('projects')
      .update({ character_reference_url: characterUrl })
      .eq('id', project.id)
  }

  // Separate broll_stock scenes (use Pexels) from generated scenes
  const generatedScenes = plan.scenes.filter(s => s.type !== 'broll_stock')
  const brollScenes = plan.scenes.filter(s => s.type === 'broll_stock')

  // Generate all non-broll images in parallel
  const [generatedResults, brollResults] = await Promise.all([
    Promise.all(generatedScenes.map(scene =>
      withRetry(() => generateSceneImage(scene, plan, project, characterUrl!))
    )),
    Promise.all(brollScenes.map(scene =>
      withRetry(() => fetchPexelsImage(scene.broll_source ?? scene.location))
    )),
  ])

  // Merge results back into scenes
  const sceneMap = new Map<number, string>()
  generatedScenes.forEach((scene, i) => {
    sceneMap.set(scene.id, generatedResults[i]!)
  })
  brollScenes.forEach((scene, i) => {
    sceneMap.set(scene.id, brollResults[i]!)
  })

  return {
    ...plan,
    scenes: plan.scenes.map(scene => ({
      ...scene,
      image_url: sceneMap.get(scene.id),
    })),
  }
}

async function generateCharacterImage(plan: ScenePlan, project: Project): Promise<string> {
  const prompt = buildCharacterPrompt({
    ...DEFAULT_CHARACTER,
    outfit_description: plan.avatar.outfit_casual,
    location_background: 'neutral studio background',
  }) + ` This is the master character reference for a ${project.name} UGC video series.`

  const result = await fal.subscribe(CHARACTER_IMAGE_MODEL, {
    input: {
      prompt,
      image_size: { width: 1080, height: 1920 },
      num_inference_steps: 4,
    },
  }) as { images?: Array<{ url: string }> }

  const url = result?.images?.[0]?.url
  if (!url) throw new Error('Character image generation returned no URL')
  return url
}

async function generateSceneImage(
  scene: Scene,
  plan: ScenePlan,
  project: Project,
  characterUrl: string
): Promise<string> {
  const { model } = selectImageModel(scene.type)
  const consistencyNote = buildConsistencyNote(characterUrl)
  const outfit = scene.outfit === 'athletic' ? plan.avatar.outfit_athletic : plan.avatar.outfit_casual

  const basePrompt = buildScenePrompt(scene.type, {
    action: scene.action,
    location: scene.location,
    product: project.name,
    product_description: plan.props.product_description,
    product_name: project.name,
    surface: 'white marble surface',
    broll_source: scene.broll_source ?? '',
  })

  const prompt = [
    basePrompt,
    `Outfit: ${outfit}`,
    `Background: ${scene.background}`,
    scene.show_product ? `Product: ${plan.props.product_description}` : '',
    consistencyNote,
  ].filter(Boolean).join('. ')

  const result = await fal.subscribe(model, {
    input: {
      prompt,
      image_size: { width: 1080, height: 1920 },
      num_inference_steps: 4,
    },
  }) as { images?: Array<{ url: string }> }

  const url = result?.images?.[0]?.url
  if (!url) throw new Error(`Scene ${scene.id} image generation returned no URL`)
  return url
}

async function fetchPexelsImage(query: string): Promise<string> {
  if (!process.env.PEXELS_API_KEY) {
    // Fallback: generate a placeholder via fal
    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt: `Cinematic b-roll footage still, ${query}, professional photography, vertical 9:16`,
        image_size: { width: 1080, height: 1920 },
        num_inference_steps: 4,
      },
    }) as { images?: Array<{ url: string }> }
    return result?.images?.[0]?.url ?? ''
  }

  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`,
    { headers: { Authorization: process.env.PEXELS_API_KEY } }
  )
  if (!res.ok) throw new Error(`Pexels API error: ${res.status}`)
  const data = await res.json() as { photos: Array<{ src: { large2x: string } }> }
  const photos = data.photos
  if (!photos.length) throw new Error(`No Pexels results for: ${query}`)
  const idx = Math.floor(Math.random() * Math.min(photos.length, 5))
  return photos[idx]!.src.large2x
}
