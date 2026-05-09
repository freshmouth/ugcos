// Run: cd apps/web && npx tsx --env-file .env.local scripts/test-pipeline.ts
import { createClient } from '@supabase/supabase-js'
import { runPipeline } from '../lib/pipeline/run'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('=== UGC.OS Pipeline Test ===\n')

  // Validate required env vars
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'FAL_KEY',
    'GEMINI_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'METRICOOL_API_KEY',
    'METRICOOL_BLOG_ID',
  ]
  const missing = required.filter(k => !process.env[k])
  if (missing.length) {
    console.error('❌ Missing env vars:', missing.join(', '))
    process.exit(1)
  }
  console.log('✓ All required env vars present\n')

  // Get first project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .limit(1)
    .single()

  if (projectError || !project) {
    console.error('❌ No project found. Complete onboarding first.')
    console.error('   Error:', projectError?.message)
    process.exit(1)
  }

  console.log(`✓ Found project: ${project.name} (${project.id})`)
  console.log(`  instagram_connected: ${project.instagram_connected}`)
  console.log(`  facebook_connected: ${project.facebook_connected}\n`)

  // Ensure social connections are set for testing
  if (!project.instagram_connected && !project.facebook_connected) {
    console.log('⚠️  No social networks connected — enabling both for this test...')
    const { error: updateErr } = await supabase
      .from('projects')
      .update({ instagram_connected: true, facebook_connected: true })
      .eq('id', project.id)
    if (updateErr) {
      console.warn('  Could not update project social connections:', updateErr.message)
    } else {
      project.instagram_connected = true
      project.facebook_connected = true
      console.log('  Updated project — both networks now enabled\n')
    }
  }

  // Create video row
  const { data: video, error: videoError } = await supabase
    .from('videos')
    .insert({
      project_id: project.id,
      user_id: project.user_id,
      status: 'pending',
      content_type: 'viral',
    })
    .select()
    .single()

  if (videoError || !video) {
    console.error('❌ Failed to create video row:', videoError?.message)
    process.exit(1)
  }

  console.log(`✓ Created video row: ${video.id}`)
  console.log('\nStarting pipeline... (this takes 3-10 minutes)\n')

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
    contentType: 'viral',
    triggeredBy: 'manual',
  })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log('\n=== Pipeline Result ===')
  console.log('Success:', result.success)
  console.log('Time:', elapsed + 's')
  if (!result.success) {
    console.error('Error:', result.error)
  } else {
    console.log('Cloudinary URL:', result.cloudinary_url)
    console.log('Captioned URL:', result.captioned_url)
    console.log('Post IDs:', result.post_ids)
  }

  // Verify final DB state
  console.log('\n=== Verifying DB state ===')
  const { data: finalVideo } = await supabase
    .from('videos')
    .select('status, cloudinary_url, captioned_url, metricool_post_id, error_message')
    .eq('id', video.id)
    .single()

  if (finalVideo) {
    console.log('status:', finalVideo.status)
    console.log('cloudinary_url:', finalVideo.cloudinary_url ? '✓' : '✗ null')
    console.log('captioned_url:', finalVideo.captioned_url ? '✓' : '✗ null')
    console.log('metricool_post_id:', finalVideo.metricool_post_id ?? '(none)')
    if (finalVideo.error_message) console.error('error_message:', finalVideo.error_message)
  }

  process.exit(result.success ? 0 : 1)
}

main().catch(err => {
  console.error('\n❌ Unhandled error:', err)
  process.exit(1)
})
