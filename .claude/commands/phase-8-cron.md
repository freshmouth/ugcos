# Phase 8 — Cron Autopilot

## Pre-flight check
Before writing anything:
1. Confirm all previous phases are working
2. Find the existing /api/cron route — show me its current contents before touching it
3. List every file you will modify (should be minimal)
4. Wait for approval before writing code

## What changes in this phase
The existing cron route picked one project randomly from lib/projects/*.js.
We replace that logic with:
- Query all active projects from Supabase where autopilot = true
- For each project: check credits, check posting time window, run pipeline
- Everything else in the pipeline stays the same (reuse Phase 6 pipeline logic)

## Cron route: /app/api/cron/route.ts (GET)

### Auth
```typescript
// Verify CRON_SECRET header to prevent unauthorized triggers
const secret = request.headers.get('x-cron-secret')
if (secret !== process.env.CRON_SECRET) {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
```
Add CRON_SECRET to env vars list. Generate a random string and set in Vercel.

### Logic
```typescript
// 1. Use SUPABASE_SERVICE_ROLE_KEY — no user session in cron context
// 2. Query active autopilot projects:
//    SELECT projects.*, credits.balance
//    FROM projects
//    JOIN credits ON credits.user_id = projects.user_id
//    WHERE projects.active = true
//    AND projects.autopilot = true
//    AND (projects.instagram_connected = true OR projects.facebook_connected = true)

// 3. For each project:
//    a. Check posting time window (skip if outside window):
//       morning   → 8–10 AM Mexico City time (UTC-6)
//       afternoon → 12–2 PM Mexico City time
//       evening   → 6–8 PM Mexico City time
//
//    b. Check credits:
//       if balance < 30 → skip project, log warning, continue to next
//
//    c. Select content_type for today:
//       index = dayOfYear % project.content_types.length
//       contentType = project.content_types[index]
//
//    d. Run pipeline (same function as /api/generate):
//       await runPipeline({ project, contentType, triggeredBy: 'cron' })
//
//    e. Log result (success or failure) with project.id tag

// 4. Return summary:
//    { processed: N, skipped: N, failed: N, details: [...] }
```

### Pipeline reuse
Extract the pipeline logic from Phase 6 into a shared function:
/lib/pipeline/run.ts
```typescript
export async function runPipeline(options: {
  project: Project,
  userId: string,
  contentType: string,
  customPrompt?: string,
  imageId?: string,
  triggeredBy: 'manual' | 'cron'
}): Promise<{ success: boolean, videoId: string, error?: string }>
```
Both /api/generate and /api/cron import and call this same function.
No duplicate pipeline code.

## Vercel cron configuration
In vercel.json (create if it doesn't exist):
```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 * * * *"
    }
  ]
}
```
Run every hour — the route itself checks if we're inside a project's posting time window.
This avoids needing multiple cron schedules.

## New env var needed
CRON_SECRET=<generate a random 32-char string>

## Posting time window helper
/lib/utils/posting-time.ts
```typescript
export function isInPostingWindow(postingTime: string): boolean {
  // Get current hour in Mexico City time (UTC-6, no DST)
  const now = new Date()
  const mexicoCityHour = (now.getUTCHours() - 6 + 24) % 24
  
  const windows = {
    morning:   { start: 8,  end: 10 },
    afternoon: { start: 12, end: 14 },
    evening:   { start: 18, end: 20 },
  }
  
  const window = windows[postingTime] ?? windows.morning
  return mexicoCityHour >= window.start && mexicoCityHour < window.end
}
```

## Low credits email alert
When cron skips a project due to insufficient credits:
Send email alert to the user via Supabase (use existing email config or Resend):
Subject: "⚠️ Autopilot paused — add credits to resume"
Body: "Your AI Video Flow autopilot for [project name] was paused today because 
you don't have enough credits. Add credits to resume automatic posting."
CTA: link to /billing

Only send this email ONCE per day per project (check videos table for today's failed attempt).

## After completing this phase
1. Test cron route manually: curl -H "x-cron-secret: YOUR_SECRET" https://your-app.vercel.app/api/cron
2. Confirm it skips projects with 0 credits
3. Confirm it only runs projects inside the posting time window
4. Confirm pipeline is called correctly for each active project
5. Deploy to Vercel and confirm the cron job appears in Vercel dashboard
6. Update CLAUDE.md Phase 8 checkbox to [x]
7. git commit -m "checkpoint: cron autopilot complete — platform MVP done"

## Final checklist after Phase 8
- [ ] All 8 phases complete
- [ ] Stripe in live mode (switch from test keys)
- [ ] Vercel env vars updated with production values
- [ ] Supabase email templates customized (magic link, welcome)
- [ ] Custom domain configured in Vercel
- [ ] CRON_SECRET set in Vercel env vars
- [ ] Stripe webhook endpoint set to production URL in Stripe dashboard
