# Phase 3 — Onboarding Flow (4 Steps)

## Pre-flight check
Before writing anything:
1. Confirm Phase 2 auth is working (session available in server components)
2. List every file you will create and every file you will modify
3. Wait for approval before writing code

## Route structure
/onboarding → single page, step managed by URL param or React state
Use URL param: /onboarding?step=1 through /onboarding?step=4
Protect this route: requires session (middleware handles this)
If onboarding_done = true → redirect to /dashboard immediately

## Shared components to build first

### /components/app/onboarding/stepper.tsx
Progress bar at top of every step.
- 4 steps shown as dots or numbered circles
- Active step: filled accent (#7C3AED)
- Completed step: filled green (#16A34A) with checkmark
- Inactive step: gray outline
- Step label below each dot (small text)

### /components/app/onboarding/step-layout.tsx
Wrapper for each step:
- Max width: max-w-xl, centered
- Heading (step title) — text-2xl font-bold
- Subheading — text-gray-400 text-sm
- Content area (slot for step form)
- Back + Next/Continue buttons at bottom

## Step 1 — Your Product (/onboarding?step=1)
Fields (all use Shadcn Input/Textarea/Select):
- Brand or product name* (Input, required)
- What does your product do? (Textarea, 300 char max, show counter)
- Who is your target audience? (Textarea, 200 char max)
- Product category (Select dropdown):
  Options: Food & Beverage / Health & Wellness / Beauty / Fashion /
  Tech / Home & Living / Services / Other

On "Continue":
- Validate required fields
- INSERT into projects table:
  { user_id, name, product_description, target_audience, product_category, status: 'draft' }
- Store project_id in sessionStorage for subsequent steps
- Advance to step 2

## Step 2 — Upload Product Photos (/onboarding?step=2)
- Drag & drop zone (use react-dropzone)
- Accept: image/jpeg, image/png, image/webp
- Min 1 image, max 10 images
- Show thumbnail grid as images are added (with X to remove)
- Each upload goes directly to Cloudinary:
  POST /api/upload/product-image
  body: FormData with file + project_id
  returns: { url, public_id }
  Cloudinary folder: catalog/{project_id}/products/
- INSERT each result into product_images table
- Show upload progress per file
- "Continue" disabled until at least 1 image uploaded

### API route: /app/api/upload/product-image/route.ts
- Auth: verify session
- Verify project_id belongs to this user
- Upload to Cloudinary using signed upload
- INSERT into product_images
- Return { url, public_id }

## Step 3 — Content Style (/onboarding?step=3)
Two sections:

### Content type selector
Multi-select cards in a 2-column grid (not dropdowns):
Each card: icon (emoji) + label + description, border highlights when selected

Cards:
- 🎓 Informative       — "Educate your audience with facts and tips"
- 🔥 Viral              — "Bold takes that spark debate and shares"
- 😱 Shocking           — "Surprising facts that stop the scroll"
- 💛 Emotional          — "Stories that connect and inspire"
- 💪 Transformation     — "Before/after, results-driven content"
- 🤣 Humor              — "Lighthearted content that makes people laugh"
- 🛒 Sales & Promo      — "Direct offer, discount, urgency-driven"

Minimum 1 selection required. Show error if user tries to continue with 0 selected.

### Posting frequency
Two large radio cards side by side:
- 🤖 Daily Autopilot    — "Generate and post automatically every day"
- 🎮 Manual Control     — "I'll trigger each video myself"

On "Continue":
- UPDATE projects SET content_types = [...], posting_frequency = ..., autopilot = (frequency === 'daily')
  WHERE id = project_id AND user_id = auth.uid()

## Step 4 — Connect Social Media (/onboarding?step=4)
Header: "Connect your social accounts"
Subheader: "You can skip this and connect later in Settings"

Two large connection cards side by side:

### Instagram card
- Instagram gradient icon
- Status: "Not connected" (gray) or "Connected ✓" (green)
- [ Connect Instagram ] button → triggers Metricool OAuth

### Facebook card
- Facebook blue icon
- Status: "Not connected" (gray) or "Connected ✓" (green)
- [ Connect Facebook ] button → triggers Metricool OAuth

### Metricool OAuth flow
Clicking Connect → opens Metricool auth URL in same tab or popup
On return with ?brand_id=xxx in callback:
- UPDATE projects SET metricool_brand_id = xxx, instagram_connected = true (or facebook_connected)
- Show green checkmark on connected card

Both platforms optional. "Finish Setup" button always enabled.

### On "Finish Setup":
- UPDATE profiles SET onboarding_done = true WHERE id = auth.uid()
- Redirect to /dashboard
- Pass success toast via URL param: /dashboard?welcome=true

## DB helper functions to create in /lib/db/projects.ts
```typescript
createProject(data)         → INSERT into projects, return project
updateProject(id, data)     → UPDATE projects WHERE id AND user_id = auth.uid()
getProject(id)              → SELECT from projects WHERE id AND user_id = auth.uid()
```

## After completing this phase
1. Test full 4-step flow with a real email
2. Confirm project row created in Supabase
3. Confirm product_images inserted after upload
4. Confirm onboarding_done flips to true after step 4
5. Confirm redirect to /dashboard after finish
6. Update CLAUDE.md Phase 3 checkbox to [x]
7. git commit -m "checkpoint: onboarding complete"

## Do NOT do in this phase
- No dashboard layout
- No billing
- No credit display
- No pipeline calls
