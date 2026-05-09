import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScenePlan } from '../types'
import { sleep } from '../utils/retry'

const SUBMAGIC_BASE = 'https://api.submagic.co'

export type CaptionResult = {
  captioned_url: string
}

function submagicHeaders(): Record<string, string> {
  return {
    'x-api-key': process.env.SUBMAGIC_API_KEY!,
    'Content-Type': 'application/json',
  }
}

export async function stage06Captions(
  cloudinaryUrl: string,
  _plan: ScenePlan,
  _projectId: string,
  videoId: string,
  supabase: SupabaseClient
): Promise<CaptionResult> {
  if (!process.env.SUBMAGIC_API_KEY) {
    console.log('[SUBMAGIC] SUBMAGIC_API_KEY not set, skipping captions')
    return { captioned_url: cloudinaryUrl }
  }

  try {
    // Step 1: Create project
    const submagicId = await createProject(cloudinaryUrl, videoId)
    console.log(`[SUBMAGIC] Created project: ${submagicId}`)

    await supabase
      .from('videos')
      .update({ submagic_project_id: submagicId })
      .eq('id', videoId)

    // Step 2: Poll until processing complete (max 5 min)
    console.log('[SUBMAGIC] Waiting for project to complete...')
    await pollUntilStatus(submagicId, ['completed'], 300_000)

    // Step 3: Trigger export
    console.log('[SUBMAGIC] Triggering export...')
    await triggerExport(submagicId)

    // Step 4: Poll until downloadUrl available (max 10 min)
    console.log('[SUBMAGIC] Waiting for download URL...')
    const downloadUrl = await pollForDownload(submagicId, 600_000)

    console.log('[SUBMAGIC] Captioned URL:', downloadUrl)
    return { captioned_url: downloadUrl }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[SUBMAGIC] Failed, using raw Cloudinary URL:', msg)
    return { captioned_url: cloudinaryUrl }
  }
}

async function createProject(videoUrl: string, videoId: string): Promise<string> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/submagic`
  const res = await fetch(`${SUBMAGIC_BASE}/v1/projects`, {
    method: 'POST',
    headers: submagicHeaders(),
    body: JSON.stringify({
      title: `UGC Video ${videoId}`,
      language: 'es',
      videoUrl,
      templateName: 'Hormozi 2',
      hookTitle: { top: 8, size: 30 },
      magicZooms: true,
      webhookUrl,
    }),
  })
  const text = await res.text()
  console.log(`[SUBMAGIC] POST /v1/projects → ${res.status}: ${text.slice(0, 300)}`)
  if (!res.ok) throw new Error(`Submagic create project ${res.status}: ${text.slice(0, 200)}`)
  const data = JSON.parse(text) as { id?: string | number }
  if (!data.id) throw new Error('Submagic returned no project ID')
  return String(data.id)
}

type SubmagicProject = {
  status: string
  transcriptionStatus?: string
  failureReason?: string
  downloadUrl?: string
  directUrl?: string
}

async function getProject(id: string): Promise<SubmagicProject> {
  const res = await fetch(`${SUBMAGIC_BASE}/v1/projects/${id}`, {
    headers: { 'x-api-key': process.env.SUBMAGIC_API_KEY! },
  })
  if (!res.ok) throw new Error(`Submagic GET project ${res.status}`)
  return res.json() as Promise<SubmagicProject>
}

async function pollUntilStatus(id: string, done: string[], timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const data = await getProject(id)
    console.log(`[SUBMAGIC] status: ${data.status}${data.transcriptionStatus ? ` transcription: ${data.transcriptionStatus}` : ''}`)
    if (done.includes(data.status)) return
    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(`Submagic project ${data.status}`)
    }
    // Transcription failure is terminal — project will never complete
    if (data.transcriptionStatus === 'FAILED') {
      throw new Error(`Submagic transcription failed: ${data.failureReason ?? 'no speech detected'}`)
    }
    await sleep(10_000)
  }
  throw new Error(`Submagic timed out after ${timeoutMs / 1000}s waiting for status: ${done.join('|')}`)
}

async function triggerExport(id: string): Promise<void> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/submagic`
  const res = await fetch(`${SUBMAGIC_BASE}/v1/projects/${id}/export`, {
    method: 'POST',
    headers: submagicHeaders(),
    body: JSON.stringify({ webhookUrl }),
  })
  const text = await res.text()
  console.log(`[SUBMAGIC] POST /v1/projects/${id}/export → ${res.status}: ${text.slice(0, 200)}`)
  if (!res.ok) throw new Error(`Submagic export ${res.status}: ${text.slice(0, 200)}`)
}

async function pollForDownload(id: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const data = await getProject(id)
    const url = data.downloadUrl ?? data.directUrl
    console.log(`[SUBMAGIC] export status: ${data.status}, downloadUrl: ${url ? '✓' : 'pending'}`)
    if (url) return url
    if (data.status === 'failed' || data.status === 'error' || data.transcriptionStatus === 'FAILED') {
      throw new Error(`Submagic export failed: ${data.failureReason ?? data.status}`)
    }
    await sleep(10_000)
  }
  throw new Error(`Submagic export timed out after ${timeoutMs / 1000}s`)
}
