import OpenAI from 'openai'
import type { SupabaseClient } from '@supabase/supabase-js'

type VideoQAResult = {
  product_stability: number
  face_consistency: number
  hand_artifacts: number
  background_stability: number
  motion_quality: number
  overall_score: number
  verdict: 'PASS' | 'FAIL'
  issues: string[]
  worst_frame: string | null
  fail_reason: string | null
}

const QA_PROMPT = `You are a QA inspector for AI-generated UGC videos.
These are 3 frames from a generated video (early/middle/late).

Check for these specific video artifacts:

1. PRODUCT STABILITY (1-10)
   Does the product stay consistent and naturally held throughout the video? Or does it float, warp, or detach from the hand?

2. FACE CONSISTENCY (1-10)
   Does the person's face remain consistent across frames? Any warping, morphing, or identity drift?

3. HAND ARTIFACTS (1-10)
   Are hands natural throughout? Extra fingers? Melting/morphing hands?

4. BACKGROUND STABILITY (1-10)
   Does the background remain stable and realistic? Any objects appearing/disappearing?

5. MOTION QUALITY (1-10)
   Does the motion look natural and UGC-authentic? Not too smooth, not jerky?

PASS: ALL scores >= 6
FAIL: ANY score below 5

Return JSON only:
{
  "product_stability": 8,
  "face_consistency": 7,
  "hand_artifacts": 6,
  "background_stability": 8,
  "motion_quality": 7,
  "overall_score": 7.2,
  "verdict": "PASS",
  "issues": [],
  "worst_frame": null,
  "fail_reason": null
}`

function extractCloudinaryFrame(cloudinaryVideoUrl: string, offsetSeconds: number): string {
  return cloudinaryVideoUrl
    .replace('/video/upload/', `/video/upload/so_${offsetSeconds}/`)
    .replace(/\.mp4(\?.*)?$/, '.jpg')
}

export async function stage04bVideoQA(
  cloudinary_url: string,
  videoId: string,
  supabase: SupabaseClient
): Promise<{ qa_score: number }> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[VIDEO-QA] OPENAI_API_KEY not set — skipping video QA')
    return { qa_score: 0 }
  }

  const frame25 = extractCloudinaryFrame(cloudinary_url, 4)
  const frame50 = extractCloudinaryFrame(cloudinary_url, 8)
  const frame75 = extractCloudinaryFrame(cloudinary_url, 12)

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: frame25 } },
        { type: 'image_url', image_url: { url: frame50 } },
        { type: 'image_url', image_url: { url: frame75 } },
        { type: 'text', text: QA_PROMPT },
      ],
    }],
  })

  const text = response.choices[0]?.message?.content?.trim() ?? '{}'
  const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim()
  const qa = JSON.parse(jsonStr) as VideoQAResult

  const scores = `stability:${qa.product_stability} face:${qa.face_consistency} hand:${qa.hand_artifacts} bg:${qa.background_stability} motion:${qa.motion_quality}`
  console.log(`[VIDEO-QA] Score: ${qa.overall_score}/10 — ${qa.verdict} (${scores})`)

  if (qa.verdict === 'PASS') {
    await supabase.from('videos').update({
      qa_video_score: qa.overall_score,
      qa_video_data: qa,
    }).eq('id', videoId)
    return { qa_score: qa.overall_score }
  }

  console.log(`[VIDEO-QA] FAILED: ${qa.fail_reason} | issues: ${qa.issues.join(', ')}`)
  throw new Error(`VIDEO_QA_FAIL: ${qa.fail_reason ?? qa.issues.join(', ')}`)
}
