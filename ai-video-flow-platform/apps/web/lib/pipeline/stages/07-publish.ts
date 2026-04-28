import type { ScenePlan, Project } from '../types'

export type PublishResult = {
  post_ids: string[]
}

export async function stage07Publish(
  project: Project,
  captionedUrl: string,
  plan: ScenePlan
): Promise<PublishResult> {
  if (!project.metricool_brand_id) {
    return { post_ids: [] }
  }

  const networks: string[] = []
  if (project.instagram_connected) networks.push('instagram')
  if (project.facebook_connected) networks.push('facebook')
  if (!networks.length) return { post_ids: [] }

  const caption = buildCaption(plan)
  const scheduledAt = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 19)

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/metricool/schedule`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blogId: project.metricool_brand_id,
        videoUrl: captionedUrl,
        text: caption,
        scheduledAt,
        timezone: 'America/Mexico_City',
        networks,
      }),
    }
  )

  if (!res.ok) {
    throw new Error(`Metricool error: ${res.status}`)
  }

  const data = await res.json() as { results?: Array<{ postId?: string }> }
  const post_ids = (data.results ?? [])
    .map(r => r.postId)
    .filter((id): id is string => Boolean(id))

  return { post_ids }
}

function buildCaption(plan: ScenePlan): string {
  const hookLine = plan.hook_text
  const ctaLine = 'Link in bio to learn more 👇'
  const hashtags = '#ugc #viral #fyp #trending'
  return `${hookLine}\n\n${ctaLine}\n\n${hashtags}`
}
