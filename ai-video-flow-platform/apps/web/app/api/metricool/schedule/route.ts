import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { schedulePost } from '@/lib/metricool/schedule'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    blogId?: string | number
    videoUrl?: string
    text?: string
    networks?: string[]
    scheduledAt?: string
    timezone?: string
  }

  const blogId = body.blogId ?? process.env.METRICOOL_BLOG_ID
  if (!blogId || !body.videoUrl || !body.networks?.length) {
    return NextResponse.json({ error: 'blogId, videoUrl and networks are required' }, { status: 400 })
  }

  try {
    const result = await schedulePost({
      blogId,
      videoUrl: body.videoUrl,
      text: body.text ?? '',
      networks: body.networks,
      scheduledAt: body.scheduledAt ?? new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 19),
      timezone: body.timezone ?? 'UTC',
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
