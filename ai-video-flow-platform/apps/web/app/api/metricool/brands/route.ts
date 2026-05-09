import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MC_BASE = 'https://app.metricool.com'
const MC_USER_ID = process.env.METRICOOL_USER_ID ?? '4210220'

function extractArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (Array.isArray(d.data)) return d.data
    if (Array.isArray(d.brands)) return d.brands
    if (Array.isArray(d.items)) return d.items
  }
  return []
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.METRICOOL_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'METRICOOL_API_KEY not set' }, { status: 500 })

  // Confirmed working endpoint: simpleProfiles returns all brands for the user
  const url = `${MC_BASE}/api/admin/simpleProfiles?userId=${MC_USER_ID}`

  try {
    const res = await fetch(url, {
      headers: { 'X-Mc-Auth': apiKey, Accept: 'application/json' },
      next: { revalidate: 300 },
    })
    const text = await res.text()
    console.log('[metricool/brands] status:', res.status, 'body:', text.slice(0, 500))

    if (!res.ok) {
      return NextResponse.json({ error: `Metricool ${res.status}`, raw: text }, { status: res.status })
    }

    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid JSON from Metricool' }, { status: 502 }) }

    const brands = extractArray(parsed)
    return NextResponse.json(brands)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
