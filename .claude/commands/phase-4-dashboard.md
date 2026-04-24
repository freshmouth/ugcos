# Phase 4 — Dashboard Layout + Main Dashboard Page

## Pre-flight check
Before writing anything:
1. Confirm Phase 3 is done (projects table has data, onboarding_done works)
2. List every file you will create and every file you will modify
3. Wait for approval before writing code

## Layout architecture
All authenticated app pages share one layout:
/app/(app)/layout.tsx → sidebar + content area

### Sidebar spec
Width: 240px fixed on desktop, collapsible on mobile (slide-in drawer)
Background: #111111
Logo: top of sidebar
Navigation items (icon + label):
  - Dashboard        /dashboard
  - Generate Video   /generate
  - My Videos        /videos
  - Settings         /settings
  - Billing          /billing

Bottom of sidebar:
  - Credit balance pill (e.g. "🪙 120 credits")
  - User avatar + email
  - Sign out button

Active route: accent left border + slightly lighter background on nav item

### Content area
Background: #0A0A0A
Padding: p-6 on desktop, p-4 on mobile
Max width: max-w-5xl, centered

## /app/(app)/dashboard/page.tsx

### Welcome toast
If URL param ?welcome=true → show toast: "Your first video is on us 🎉 You have 30 credits to get started."
Then remove param from URL.

### Stats row (4 cards)
```
[  Credits Remaining  ] [  Total Videos  ] [  Last Posted  ] [  Social Status  ]
[    120 credits      ] [      0          ] [    Never       ] [ IG ✓  FB ✗      ]
[ [ Top Up ] button   ]
```
Cards: bg #111111, rounded-xl, p-5, border border-gray-800

### Primary CTA
Large centered button below stats:
[ ▶ Generate New Video ]
bg #7C3AED, text-white, text-lg, font-bold, px-8 py-4, rounded-xl
Below it: "Costs 30 credits · You have X remaining"
If credits < 30 → button shows "Top Up to Generate" → links to /billing

### Video history section
Heading: "Your Videos"
Empty state (when no videos):
  Illustration + "No videos yet" + "Generate your first video to get started" + CTA button

Table (when videos exist):
Columns:
  - Thumbnail (60x100 rounded, 9:16 aspect)
  - Date (formatted: "Apr 18, 2025")
  - Status (badge — see status colors below)
  - Content Type (pill)
  - Actions: [ Preview ] [ Repost ] buttons

Status badge colors:
  pending    → gray    bg-gray-800 text-gray-400
  generating → yellow  bg-yellow-900 text-yellow-400 + pulse animation
  processing → yellow  same as generating
  uploading  → blue    bg-blue-900 text-blue-400
  captioning → blue    same as uploading
  posting    → blue    same as uploading
  done       → green   bg-green-900 text-green-400
  failed     → red     bg-red-900 text-red-400

### Video preview modal
Click row or Preview button → opens modal (Shadcn Dialog)
Content:
  - Video player (HTML5 <video> with controls, autoplay muted)
  - Script prompt used (text-sm text-gray-400)
  - Date generated
  - Status
  - [ Repost ] button (calls Metricool again)
  - [ Download ] button (link to cloudinary_url or captioned_url)

## Realtime subscription
Use Supabase realtime on the videos table filtered to user_id.
When any video row updates → refresh the video list and status badge automatically.
Do NOT poll. Use:
```typescript
supabase
  .channel('videos')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'videos',
    filter: `user_id=eq.${userId}`
  }, handleVideoUpdate)
  .subscribe()
```

## DB helper functions to create in /lib/db/

### /lib/db/videos.ts
```typescript
getUserVideos(userId)       → SELECT * FROM videos WHERE user_id ORDER BY created_at DESC
getVideoById(id, userId)    → SELECT * FROM videos WHERE id AND user_id
```

### /lib/db/credits.ts
```typescript
getCreditBalance(userId)    → SELECT balance FROM credits WHERE user_id
getTransactions(userId)     → SELECT * FROM credit_transactions WHERE user_id ORDER BY created_at DESC LIMIT 20
```

## After completing this phase
1. Confirm sidebar renders on desktop and mobile
2. Confirm stats cards load with real data from Supabase
3. Confirm empty state shows when no videos
4. Confirm realtime subscription updates status badge without page refresh
5. Update CLAUDE.md Phase 4 checkbox to [x]
6. git commit -m "checkpoint: dashboard complete"

## Do NOT do in this phase
- No actual video generation
- No Stripe
- No settings page
- Only dashboard layout + dashboard page + video history + realtime
