// Run: cd apps/web && npx tsx --env-file .env.local scripts/run-canela.ts
import { createClient } from '@supabase/supabase-js'
import { runPipeline } from '../lib/pipeline/run'

const CANELA_PROJECT_ID = '98a9cb9b-ac57-4d04-bd03-6bcb0e13a4c1'

async function main() {
  console.log('=== Full Pipeline — Canela de Ceylán ===\n')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const required = [
    'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'FAL_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  ]
  const missing = required.filter(k => !process.env[k])
  if (missing.length) { console.error('❌ Missing env vars:', missing.join(', ')); process.exit(1) }

  console.log('✓ Env vars OK')
  console.log(`  OpenAI:   ${process.env.OPENAI_API_KEY   ? '✓' : '⚠ not set'}`)
  console.log(`  Submagic: ${process.env.SUBMAGIC_API_KEY ? '✓' : '⚠ not set (captions skipped)'}`)
  console.log(`  Metricool:${process.env.METRICOOL_API_KEY? '✓' : '⚠ not set (publish skipped)'}\n`)

  const { data: project, error: pErr } = await sb
    .from('projects')
    .select('*')
    .eq('id', CANELA_PROJECT_ID)
    .single()

  if (pErr || !project) {
    console.error('❌ Canela de Ceylán project not found:', pErr?.message)
    process.exit(1)
  }

  console.log(`Project: ${project.name} (${project.id})`)
  console.log(`  Instagram: ${project.instagram_connected} | Facebook: ${project.facebook_connected}`)
  console.log(`  Metricool brand: ${project.metricool_brand_id}`)
  console.log(`  Cloudinary folder: ${project.cloudinary_folder}`)
  console.log(`  Product: ${String(project.product_description ?? '').slice(0, 80)}`)

  const { data: video, error: vErr } = await sb
    .from('videos')
    .insert({
      project_id: project.id,
      user_id: project.user_id,
      status: 'pending',
      content_type: 'scroll_stopper',
    })
    .select()
    .single()

  if (vErr || !video) { console.error('❌ Failed to create video row:', vErr?.message); process.exit(1) }
  console.log(`\n✓ Video row created: ${video.id}`)
  console.log('Starting full pipeline (stages 1-7)… this takes 5-12 minutes.\n')

  const start = Date.now()
  const result = await runPipeline({
    project: {
      ...project,
      character_reference_url: project.character_reference_url ?? null,
      voice_reference_url: project.voice_reference_url ?? null,
      hooks_library: project.hooks_library ?? [],
    },
    userId: project.user_id,
    videoId: video.id,
    contentType: 'scroll_stopper',
    triggeredBy: 'manual',
  })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('\n=== Result ===')
  console.log('Success:', result.success)
  console.log('Time:', elapsed + 's')

  if (!result.success) {
    console.error('Error:', result.error)
  } else {
    console.log('Cloudinary URL:', result.cloudinary_url)
    console.log('Captioned URL:', result.captioned_url?.slice(0, 100) + '...')
    console.log('Post IDs:', result.post_ids?.join(', ') || '(none)')
  }

  const { data: final } = await sb
    .from('videos')
    .select('status, cloudinary_url, captioned_url, metricool_post_id, error_message')
    .eq('id', video.id)
    .single()

  if (final) {
    console.log('\n=== DB State ===')
    console.log('status:            ', final.status)
    console.log('cloudinary_url:    ', final.cloudinary_url    ? '✓' : '✗ null')
    console.log('captioned_url:     ', final.captioned_url     ? '✓' : '✗ null')
    console.log('metricool_post_id: ', final.metricool_post_id ?? '(none)')
    if (final.error_message) console.error('error_message:', final.error_message)
  }

  process.exit(result.success ? 0 : 1)
}

main().catch(err => { console.error('\n❌ Unhandled error:', err); process.exit(1) })
