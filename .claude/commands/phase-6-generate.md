# Phase 6 — Generate Page + Pipeline API

## Pre-flight check
Before writing anything:
1. Confirm subscriptions table exists and billing works (Phase 5 done)
2. Find the existing pipeline code — show me the entry point file before touching it
3. DO NOT rewrite the existing pipeline — wrap it with subscription-aware logic
4. List every file you will create and every file you will modify
5. Wait for approval before writing code

## Core principle
The existing FAL → Cloudinary → Submagic → Metricool pipeline is already working.
We are NOT rewriting it. We are:
  a) Wrapping it in an authenticated API route
  b) Gating it by active subscription + monthly video quota
  c) Feeding it project config from Supabase instead of hardcoded lib/projects/*.js
  d) Writing status updates to the videos table at each step
  e) FIXING the video duration bug: duration MUST be 15, always explicit

## Bug fix — do this first before anything else
Search the entire codebase for every FAL video generation call.
Find every fal.run() or fal.subscribe() for the Sora 2 model.
Show me the current call and the fixed version.
Ensure ALL calls have: duration: 15, aspect_ratio: "9:16" — hardcoded, never a variable.

## Quota check helper: /lib/subscriptions/quota.ts
```typescript
export async function checkVideoQuota(userId: string): Promise<{
  allowed: boolean
  reason?: 'no_subscription' | 'quota_exceeded' | 'subscription_inactive'
  remaining?: number
}> {
  const sub = await getSubscription(userId)
  if (!sub) return { allowed: false, reason: 'no_subscription' }
  if (sub.status !== 'active' && sub.status !== 'trialing')
    return { allowed: false, reason: 'subscription_inactive' }
  if (sub.videos_limit === null) return { allowed: true, remaining: Infinity }
  const remaining = sub.videos_limit - sub.videos_used_this_cycle
  if (remaining <= 0) return { allowed: false, reason: 'quota_exceeded' }
  return { allowed: true, remaining }
}
```

## Pipeline API: /app/api/generate/route.ts (POST)

### Request body
```typescript
{
  project_id: string,
  content_type_override?: string,
  custom_prompt?: string,
  image_id?: string,
}
```

### Flow
```
1. VERIFY AUTH
   Reject if no session.
   Fetch project from Supabase — verify project.user_id = auth.uid()

2. CHECK QUOTA (replaces credit check)
   const quota = await checkVideoQuota(userId)
   if (!quota.allowed) return 403 { error: quota.reason }

3. CREATE VIDEO ROW
   INSERT into videos: { project_id, user_id, status: 'pending', content_type }
   Return { video_id } to client immediately
   Run pipeline in background (do not await — use Vercel waitUntil or fire-and-forget)

4. INCREMENT QUOTA COUNTER
   await incrementVideoCount(userId)
   (Decrement on failure — see step 5 error handling)

5. PIPELINE
   Update videos.status at each step via updateVideoStatus(videoId, status)

   STEP 1 — status: 'generating'
     Select product image:
       - If image_id provided: use that product_image URL
       - Else: pick from project's product_images (random)
     Call FAL image generation:
       model: project.imageGenModel (default 'fal-ai/flux/schnell')
       prompt: built from project.system_prompt + content_type
     UPDATE videos SET fal_image_url = result.url

   STEP 2 — status: 'processing'
     Select script prompt:
       - If custom_prompt provided: use it
       - Else: rotate through project.script_prompts by day-of-year index
     Call FAL Sora 2:
       *** CRITICAL: duration MUST be 15 — never a variable, never a default ***
       {
         prompt: selectedPrompt,
         image_url: fal_image_url,
         duration: 15,
         aspect_ratio: "9:16"
       }
     Await completion via fal.subscribe or fal.queue.result
     UPDATE videos SET fal_video_url = result.url, script_prompt = selectedPrompt

   STEP 3 — status: 'uploading'
     Upload fal_video_url to Cloudinary:
       folder: project.cloudinary_folder + 'videos/'
       tags: [project.id, userId, content_type]
       Apply existing upscale transformation
     UPDATE videos SET cloudinary_url = secure_url

   STEP 4 — status: 'captioning'
     Call Submagic API with cloudinary_url
     Await captioned video URL
     UPDATE videos SET captioned_url = result.url

   STEP 5 — status: 'posting'
     Only post if project has connected platforms:
       instagram_connected → post to Instagram
       facebook_connected  → post to Facebook
     Call Metricool API:
       brand_id: project.metricool_brand_id
       video_url: captioned_url
       caption: selectedPrompt (truncated to platform limits)
     UPDATE videos SET metricool_post_id = result.post_id

   STEP 6 — status: 'done'
     UPDATE videos SET status = 'done'

6. ON ANY STEP FAILURE
   UPDATE videos SET status = 'failed', error_message = error.message
   Refund quota: await decrementVideoCount(userId)
   Log error with project.id tag via existing Cloudinary log system
```

## Shared pipeline function
Extract pipeline logic into /lib/pipeline/run.ts so cron can reuse it:

```typescript
export async function runPipeline(options: {
  project: Project
  userId: string
  videoId: string
  contentType: string
  customPrompt?: string
  imageId?: string
  triggeredBy: 'manual' | 'cron'
}): Promise<{ success: boolean; error?: string }>
```

Both /api/generate and /api/cron import this. No duplicated pipeline code.

## Generate page: /app/(app)/generate/page.tsx

### Quota display at top
```
Active plan: Growth  ·  32 / 60 videos used this month  ·  Resets May 15
[████████░░░░░░░░░░░░]
```
If quota exhausted:
Yellow banner: "You've used all 60 videos for this month."
[ Upgrade Plan ] → /billing   [ Wait for reset: May 15 ]

Scale tier: show "Unlimited" instead of progress bar.

### Form fields

1. Content Type
   Pill selector showing project's saved content_types.
   User can pick one for this run.

2. Product Image (optional)
   Thumbnail grid of uploaded product images.
   Click to select specific image, or leave empty = AI picks.

3. Custom Hook Prompt (optional)
   Textarea: "Override the AI script (optional)"
   Placeholder: "Leave empty to auto-generate from your content library"

4. Generate button
   [ ▶ Generate Video ]
   Full width, bg #7C3AED, font-bold, h-14, rounded-xl
   Disabled if: quota exhausted OR generation in progress
   Show remaining count below: "28 videos remaining this month"

### After clicking Generate
1. POST /api/generate → receive { video_id }
2. Redirect to /dashboard
3. Realtime subscription shows live status updates on the video row
4. Toast: "Generating your video... we'll update you in a few minutes"

## DB helpers to add

### /lib/db/videos.ts additions
```typescript
createVideo(data)
updateVideoStatus(id, status, extra?)
```

### /lib/db/subscriptions.ts additions
```typescript
incrementVideoCount(userId)  → videos_used_this_cycle += 1
decrementVideoCount(userId)  → videos_used_this_cycle -= 1 (refund on failure)
```

## After completing this phase
1. Test full generate flow end-to-end with a real project
2. Confirm video status updates in realtime on dashboard
3. Confirm quota increments after successful generation
4. Confirm quota decrements if pipeline fails
5. Confirm video is 15 seconds (check FAL dashboard logs)
6. Test quota block when at limit (temporarily set videos_limit = 0 to test)
7. Update CLAUDE.md Phase 6 checkbox to [x]
8. git commit -m "checkpoint: generate + pipeline complete"

## Do NOT do in this phase
- No credits system — does not exist
- No settings page
- No cron yet
