const METRICOOL_BASE = 'https://app.metricool.com/api'

export type SchedulePostInput = {
  blogId: string | number
  videoUrl: string
  text: string
  networks: string[]
  scheduledAt: string
  timezone?: string
}

export type SchedulePostResult = {
  success: boolean
  post_ids: string[]
  raw?: unknown
}

function buildParams(blogId: string | number): URLSearchParams {
  const params = new URLSearchParams()
  params.set('blogId', String(blogId))
  params.set('userId', process.env.METRICOOL_USER_ID ?? '4210220')
  return params
}

function metricoolHeaders(): Record<string, string> {
  return {
    'X-Mc-Auth': process.env.METRICOOL_API_KEY!,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function normalizeMediaUrl(videoUrl: string, blogId: string | number): Promise<string> {
  const params = buildParams(blogId)
  params.set('url', videoUrl)
  const url = `${METRICOOL_BASE}/actions/normalize/image/url?${params.toString()}`

  const res = await fetch(url, { headers: metricoolHeaders() })
  console.log(`[METRICOOL] normalize → ${res.status}`)

  if (!res.ok) {
    const text = await res.text()
    console.warn(`[METRICOOL] normalize failed ${res.status}: ${text.slice(0, 200)} — using original URL`)
    return videoUrl
  }

  const data = await res.json() as unknown
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    const mediaUrl = (d.url ?? d.mediaUrl ?? d.media_url ?? d.normalizedUrl) as string | undefined
    if (mediaUrl) return mediaUrl
  }
  console.warn('[METRICOOL] normalize returned unexpected shape, using original URL:', JSON.stringify(data).slice(0, 200))
  return videoUrl
}

export async function schedulePost(input: SchedulePostInput): Promise<SchedulePostResult> {
  const apiKey = process.env.METRICOOL_API_KEY
  if (!apiKey) throw new Error('METRICOOL_API_KEY is not set')

  const userId = Number(process.env.METRICOOL_USER_ID ?? '4210220')
  const blogId = Number(input.blogId)
  const timezone = input.timezone ?? 'America/Mexico_City'

  const metricoolMediaUrl = await normalizeMediaUrl(input.videoUrl, blogId)

  const params = buildParams(blogId)
  const url = `${METRICOOL_BASE}/v2/scheduler/posts?${params.toString()}`

  const providers: Array<Record<string, unknown>> = []
  if (input.networks.includes('instagram')) providers.push({ network: 'instagram' })
  if (input.networks.includes('facebook')) providers.push({ network: 'facebook' })
  if (!providers.length) {
    providers.push({ network: 'instagram' }, { network: 'facebook' })
  }

  const body = {
    publicationDate: {
      dateTime: input.scheduledAt,
      timezone,
    },
    text: input.text,
    autoPublish: true,
    providers,
    instagramData: { autoPublish: true, type: 'REEL' },
    facebookData: { type: 'POST' },
    media: [metricoolMediaUrl],
    creatorUserId: userId,
  }

  console.log('[METRICOOL] POST scheduler/posts body:', JSON.stringify(body))

  const res = await fetch(url, {
    method: 'POST',
    headers: metricoolHeaders(),
    body: JSON.stringify(body),
  })

  const rawText = await res.text()
  console.log(`[METRICOOL] scheduler/posts → ${res.status}: ${rawText.slice(0, 300)}`)

  if (!res.ok) {
    throw new Error(`Metricool API error ${res.status}: ${rawText.slice(0, 300)}`)
  }

  let data: Record<string, unknown> = {}
  try { data = JSON.parse(rawText) as Record<string, unknown> } catch { /* non-JSON 2xx */ }

  // Metricool returns { data: { id: 320442199, ... } } for single posts
  const inner = (data.data ?? {}) as Record<string, unknown>
  const results = (data.results as Array<{ postId?: string; id?: string }> | undefined) ?? []
  const singleId = String(data.postId ?? data.id ?? inner.postId ?? inner.id ?? '').trim() || undefined
  const post_ids = results.map(r => r.postId ?? r.id).filter((id): id is string => Boolean(id))
  if (singleId && !post_ids.length) post_ids.push(singleId)

  return { success: true, post_ids, raw: data }
}
