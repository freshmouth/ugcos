import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get('postId')
  if (!postId) return NextResponse.json({})

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({}, { status: 401 })

  const { data, error } = await supabase
    .from('videos')
    .select('captioned_url, cloudinary_url, fal_image_url')
    .eq('user_id', user.id)
    .eq('metricool_post_id', postId)
    .maybeSingle()

  if (error) return NextResponse.json({})
  return NextResponse.json(data ?? {})
}
