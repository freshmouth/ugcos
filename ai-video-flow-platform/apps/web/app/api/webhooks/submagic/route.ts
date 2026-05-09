import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      projectId?: string | number
      status?: string
      downloadUrl?: string
    }

    console.log('[SUBMAGIC WEBHOOK]', JSON.stringify(body).slice(0, 300))

    if (body.status === 'completed' && body.downloadUrl && body.projectId) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { error } = await supabase
        .from('videos')
        .update({ captioned_url: body.downloadUrl })
        .eq('submagic_project_id', String(body.projectId))
      if (error) console.error('[SUBMAGIC WEBHOOK] DB update error:', error.message)
    }
  } catch (e) {
    console.error('[SUBMAGIC WEBHOOK] Error:', e)
  }

  return NextResponse.json({ ok: true })
}
