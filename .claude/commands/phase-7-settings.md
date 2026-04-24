# Phase 7 — Settings Page

## Pre-flight check
Before writing anything:
1. Confirm generate + pipeline is working (Phase 6 done)
2. List every file you will create and every file you will modify
3. Wait for approval before writing code

## Route
/app/(app)/settings/page.tsx
Tab-based layout using Shadcn Tabs component.

## Tab structure
4 tabs: Profile | My Product | Social Accounts | Autopilot

## Tab 1 — Profile
Fields:
- Full name (Input, editable)
- Email (Input, read-only — show "Managed by your login" below it)
- Avatar (circular image upload, 80x80px)
  Click to upload → upload to Cloudinary under avatars/{user_id}/
  UPDATE profiles SET avatar_url = ...

Save button at bottom: [ Save Profile ]
Success: green toast "Profile updated"

## Tab 2 — My Product
Reuse the same form components from onboarding Steps 1–3.
Load current values from projects table.

Sections:
- Brand name, product description, target audience, category (same as Step 1)
- Product images gallery (same as Step 2)
  Show existing images as deletable thumbnails (X button)
  DELETE product_image + Cloudinary delete on X
  Upload new images same as onboarding
- Content types selector (same as Step 3 multi-select cards)

Additional section: AI Content Library
  Heading: "Script Prompt Library"
  Subheading: "These hooks and scripts are used to generate your videos"
  Editable list of script_prompts:
    - Each prompt shown as a text area row
    - [ + Add prompt ] button appends empty row
    - [ × ] button removes a prompt
    - Minimum 1 prompt required
  [ Regenerate with AI ] button:
    Calls internal Claude API to generate 7 new script prompts based on
    product_description + content_types
    Preview the generated prompts before saving (show in modal)

Save button: [ Save Product Settings ]

## Tab 3 — Social Accounts
Two cards side by side (stack on mobile):

### Instagram card
Status indicator (green "Connected" or gray "Not connected")
If connected:
  - Show connected brand name/handle if available from Metricool
  - [ Disconnect ] button → clear metricool_brand_id + instagram_connected = false
  Toggle: "Post to Instagram" on/off (even if connected, can disable per platform)

If not connected:
  - [ Connect Instagram ] → Metricool OAuth

### Facebook card
Same pattern as Instagram.

Note below both cards:
"Connections are managed via Metricool. Disconnecting here removes posting 
permissions but doesn't disconnect your Metricool account."

## Tab 4 — Autopilot
Heading: "Autopilot Settings"
Subheading: "When enabled, a video is generated and posted automatically every day"

### Master toggle
Large toggle switch:
[ Autopilot: OFF ] / [ Autopilot: ON ]
Accent green when ON.
UPDATE projects SET autopilot = true/false

### Posting time (only shown when autopilot ON)
Select: When should we post?
Options:
  - 🌅 Morning (8–10 AM local time)
  - ☀️ Afternoon (12–2 PM local time)
  - 🌆 Evening (6–8 PM local time)
UPDATE projects SET posting_time = ...

### Content rotation order (only shown when autopilot ON)
Heading: "Content type rotation"
Subheading: "Drag to reorder — we'll cycle through these types daily"
Draggable list of selected content types (react-beautiful-dnd or dnd-kit)
Order is saved as-is to projects.content_types[]

Save button: [ Save Autopilot Settings ]

### Credits warning
If autopilot is ON but credits < 30:
Yellow warning banner: "⚠️ You need at least 30 credits for autopilot to run. Add credits to avoid missing posts."
Link: [ Add Credits → ]

## DB helper functions to add to /lib/db/

### /lib/db/profiles.ts
```typescript
getProfile(userId)         → SELECT from profiles WHERE id
updateProfile(userId, data) → UPDATE profiles WHERE id
```

### Updates to /lib/db/projects.ts
```typescript
updateProjectSocial(id, data)    → UPDATE metricool_brand_id, instagram_connected, facebook_connected
updateAutopilot(id, data)        → UPDATE autopilot, posting_time, content_types
```

## After completing this phase
1. Test profile update saves correctly
2. Test product image delete removes from Cloudinary + DB
3. Test script prompt editing saves to projects.script_prompts
4. Test autopilot toggle updates DB
5. Confirm autopilot shows warning when credits low
6. Update CLAUDE.md Phase 7 checkbox to [x]
7. git commit -m "checkpoint: settings complete"
