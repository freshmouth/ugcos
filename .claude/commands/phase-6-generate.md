# Phase 6 — Generate Page + Pipeline API

## Pre-flight check
Before writing anything:
1. Confirm billing is working (credits deduct and refill)
2. Confirm the existing pipeline code location — find files in /lib/pipeline/ or equivalent
3. DO NOT rewrite the existing pipeline — adapt it to accept project config from Supabase
4. List every file you will create and every file you will modify
5. Wait for approval before writing code

## Core rule for this phase
The existing FAL → Cloudinary → Submagic → Metricool pipeline works.
We are NOT rewriting it. We are:
a) Wrapping it in an authenticated API route
b) Feeding it project config from Supabase instead of lib/projects/*.js
c) Adding credit deduction/refund logic around it
d) Writing status updates to the videos table at each step
e) FIXING the video duration bug: duration must be 15, always explicit

## Bug fix — locate and fix first, before any other changes
Search the entire codebase for the FAL video generation call.
Find every occurrence of fal.run() or fal.subscribe() for the Sora 2 model.
Ensure ALL calls include: duration: 15, aspect_ratio: "9:16"
Show me the current call and the fixed version before proceeding.

## Pipeline API route: /app/api/generate/route.ts (POST)

### Request
```typescript
{
  project_id: string,
  content_type_override?: string,   // optional, overrides project.content_types[0]
  custom_prompt?: string,           // optional, replaces auto-selected script prompt
  image_id?: string,                // optional, use specific product image
}
```

### Auth
Reject if no session. User can only generate for their own projects.

### Flow
```
1. VALIDATE
   - Fetch project from Supabase (verify user_id = auth.uid())
   - Fetch credit balance
   - If balance < 30 → return 402 { error: 'insufficient_credits' }

2. DEDUCT CREDITS
   - UPDATE credits SET balance = balance - 30 WHERE user_id
   - INSERT credit_transactions (amount: -30, reason: 'video_generated')

3. CREATE VIDEO ROW
   - INSERT into videos: { project_id, user_id, status: 'pending', content_type, script_prompt }
   - Return { video_id } to client immediately (don't await pipeline)
   - Run pipeline in background (use waitUntil if on Vercel Edge, or fire-and-forget)

4. PIPELINE (update video status at each step)
   Each step: UPDATE videos SET status = '...', updated_at = now() WHERE id = video_id

   STEP 1 — status: 'generating'
     Select product image:
       - If image_id provided: fetch that product_image URL
       - Else: pick random from project's product_images
     Call FAL image generation:
       model: project.imageGenModel (from project row, default: 'fal-ai/flux/schnell')
       prompt: build from project.system_prompt + content_type + script_prompt
     UPDATE videos SET fal_image_url = result.url

   STEP 2 — status: 'processing'
     Select script prompt:
       - If custom_prompt provided: use it
       - Else: pick from project.script_prompts by rotating index (day-of-year % array.length)
     Call FAL Sora 2:
       CRITICAL: duration MUST be 15 — hardcoded, no variable, no default
       {
         prompt: selectedScriptPrompt,
         image_url: fal_image_url,
         duration: 15,
         aspect_ratio: "9:16"
       }
     Poll until complete (fal.subscribe or fal.queue.result)
     UPDATE videos SET fal_video_url = result.url, script_prompt = selectedPrompt

   STEP 3 — status: 'uploading'
     Upload fal_video_url to Cloudinary:
       folder: project.cloudinary_folder + 'videos/'
       tags: [project.id, user_id, content_type]
       Apply upscale transformation (use existing Cloudinary config)
     UPDATE videos SET cloudinary_url = secure_url

   STEP 4 — status: 'captioning'
     Call Submagic API with cloudinary_url:
       style: project.submagicStyle (or default)
       request: hook + burned-in captions
     Await captioned video URL
     UPDATE videos SET captioned_url = result.url

   STEP 5 — status: 'posting'
     Call Metricool API:
       brand_id: project.metricool_brand_id
       video_url: captioned_url
       caption: selectedScriptPrompt (truncated to platform limits)
       platforms: derive from project.instagram_connected + project.facebook_connected
     UPDATE videos SET metricool_post_id = result.post_id

   STEP 6 — status: 'done'
     UPDATE videos SET status = 'done', updated_at = now()

5. ON ANY STEP FAILURE
   - UPDATE videos SET status = 'failed', error_message = error.message
   - Refund credits:
     UPDATE credits SET balance = balance + 30
     INSERT credit_transactions (amount: +30, reason: 'refund', video_id)
   - Log error with project_id tag to Cloudinary (existing log system)
```

## Generate page: /app/(app)/generate/page.tsx

### Layout
Clean single-column form, max-w-lg centered.
Heading: "Generate a Video"
Subheading: "Creates a 15-second video and posts to your social accounts"

### Credit display at top
```
🪙 120 credits remaining · This video costs 30 credits
```
If < 30 credits: replace with warning banner + "Add Credits" button → /billing

### Form fields

1. Content Type (from project preferences, overridable)
   Pill-style selector showing project's saved content_types, user can pick one for this run

2. Product Image (optional override)
   Small grid of their uploaded product images (from product_images table)
   Click to select, or leave unselected = AI picks automatically
   Shown as thumbnails, 60px wide

3. Custom Hook Prompt (optional)
   Textarea: "Override the AI script (optional)"
   Placeholder: "Leave empty to auto-generate from your content library"

4. Generate button
   [ ▶ Generate Video — 30 credits ]
   Full width, bg #7C3AED, font-bold, h-14, rounded-xl
   Disabled if: credits < 30 OR generating in progress

### After clicking Generate
1. Call POST /api/generate → receive { video_id }
2. Redirect to /dashboard
3. Dashboard's realtime subscription picks up the new video row and shows live status
4. Show toast: "Generating your video... we'll update you when it's ready"

## DB helper functions to add to /lib/db/videos.ts
```typescript
createVideo(data)                → INSERT into videos
updateVideoStatus(id, status, extra?)  → UPDATE videos SET status + any extra fields
refundVideoCredits(userId, videoId)    → UPDATE credits + INSERT transaction
```

## After completing this phase
1. Test full generate flow with a real project (use test FAL keys if available)
2. Confirm video row status updates in realtime on dashboard
3. Confirm credits deducted before pipeline, refunded on failure
4. Confirm video duration is 15s in FAL call (check FAL dashboard logs)
5. Update CLAUDE.md Phase 6 checkbox to [x]
6. git commit -m "checkpoint: pipeline + generate page complete"
