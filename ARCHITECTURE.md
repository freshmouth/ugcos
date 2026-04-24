# Architecture Reference

## Auth flow
```
/login (email input)
  → supabase.auth.signInWithOtp({ email })
  → user clicks email link
  → /auth/callback
  → check profiles.onboarding_done
    → false → /onboarding
    → true  → /dashboard
```

## Onboarding flow
```
/onboarding?step=1  Product info        → INSERT projects (draft)
/onboarding?step=2  Upload images       → INSERT product_images, upload to Cloudinary
/onboarding?step=3  Content style       → UPDATE projects (content_types, posting_frequency)
/onboarding?step=4  Connect social      → Metricool OAuth → UPDATE projects (metricool_brand_id)
  → UPDATE profiles.onboarding_done = true
  → /dashboard
```

## Database relationships
```
auth.users
  └── profiles (1:1)
        └── credits (1:1)
        └── credit_transactions (1:N)
        └── projects (1:N)
              └── product_images (1:N)
              └── videos (1:N)
```

## API routes
```
POST /api/generate
  body: { project_id, content_type_override?, custom_prompt? }
  auth: required
  flow: check credits → deduct → create video row → run pipeline → update status

POST /api/billing/create-checkout
  body: { package_id }
  auth: required
  returns: { url } (Stripe Checkout URL)

POST /api/billing/webhook
  headers: stripe-signature
  auth: Stripe signature verification only
  flow: verify → add credits → insert transaction

GET /api/cron
  auth: CRON_SECRET header
  flow: get all active+autopilot projects with sufficient credits → run pipeline per project
```

## Video status lifecycle
```
pending → generating (FAL image) → processing (FAL video) →
uploading (Cloudinary) → captioning (Submagic) → posting (Metricool) →
done | failed
```

## Credit packages (Stripe products)
```
starter_60    60 credits   $10 USD   (2 videos)
growth_150   150 credits   $20 USD   (5 videos)  ← best value
pro_360      360 credits   $40 USD   (12 videos)
```

## Metricool integration
- OAuth connects user's brand profile
- Returns brand_id stored in projects.metricool_brand_id
- POST /api/metricool/post with { brand_id, video_url, caption, platforms[] }
- Platforms: ['facebook', 'instagram']

## Cloudinary folder structure
```
catalog/
  {project_id}/
    products/     ← uploaded product images
    avatars/      ← avatar images
    videos/       ← generated videos
    upscaled/     ← post-upscale videos
```

## Supabase realtime
- Subscribe to videos table filtered by id
- Update UI status badge on each status change
- No polling needed — pure realtime
