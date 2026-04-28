import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPipelineLogs } from '@/lib/db/pipeline-logs'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

function getServiceClient(): SupabaseClient {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  ) as unknown as SupabaseClient
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { videoId } = await params

  const { data: video } = await supabase
    .from('videos')
    .select('id, status, cloudinary_url, captioned_url, error_message, created_at, updated_at')
    .eq('id', videoId)
    .eq('user_id', user.id)
    .single()

  if (!video) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const serviceSupa = getServiceClient()
  const logs = await getPipelineLogs(serviceSupa, videoId).catch(() => [])

  return NextResponse.json({ video, logs })
}
