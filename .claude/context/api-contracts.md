# API Contracts Reference

## Internal API Routes

### POST /api/generate
Auth: Required (Supabase session cookie)
Request:
  {
    project_id: string (uuid),
    content_type_override?: string,
    custom_prompt?: string,
    image_id?: string (uuid of product_image)
  }
Response 200:
  { video_id: string }
Response 402:
  { error: 'insufficient_credits' }
Response 403:
  { error: 'project_not_found' }

### POST /api/billing/create-checkout
Auth: Required
Request:
  { package_id: 'starter' | 'growth' | 'pro' }
Response 200:
  { url: string } (Stripe Checkout URL, redirect client to this)

### POST /api/billing/webhook
Auth: Stripe signature header (x-stripe-signature)
Handles: checkout.session.completed only
Response: 200 OK always (Stripe retries on non-200)

### GET /api/cron
Auth: x-cron-secret header must match CRON_SECRET env var
Response 200:
  { processed: number, skipped: number, failed: number }

### POST /api/upload/product-image
Auth: Required
Request: FormData { file: File, project_id: string }
Response 200:
  { url: string, public_id: string }

## External APIs used

### FAL AI — Image Generation
Model: project.imageGenModel (default: 'fal-ai/flux/schnell')
Input: { prompt, image_size: { width: 1080, height: 1920 } }

### FAL AI — Video Generation (Sora 2)
Model: 'fal-ai/sora' (confirm exact model string from existing code)
Input: {
  prompt: string,
  image_url: string,
  duration: 15,          ← ALWAYS 15, non-negotiable
  aspect_ratio: "9:16"
}

### Cloudinary
Upload: cloudinary.uploader.upload(url, { folder, tags })
Delete: cloudinary.uploader.destroy(public_id)
Folder convention: catalog/{project_id}/products/ | videos/ | avatars/

### Submagic
Endpoint: (check existing code for exact URL and params)
Input: { video_url, style }
Output: { captioned_url }

### Metricool
Post endpoint: (check existing code for exact URL and params)
Input: { brand_id, video_url, caption, platforms[] }
Output: { post_id }
