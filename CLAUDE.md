# AI Video Flow Platform — Master Context

## What this is
Multi-tenant SaaS. Users sign up, onboard their product, and the platform
automatically generates 15-second short-form videos and posts them to Instagram
and Facebook daily via autopilot.

## Stack
- Next.js 14 App Router (Vercel deployment)
- Supabase (auth + DB + realtime subscriptions)
- Stripe (payments + webhooks)
- FAL AI — image gen (Nano Banana Pro) + video gen (Sora 2, ALWAYS 15s)
- Cloudinary (storage + upscale)
- Submagic (captions burned into video)
- Metricool (social posting: Instagram + Facebook)
- Tailwind CSS + Shadcn/ui

## Absolute rules — never violate
1. Video duration — Sora: 16 seconds, Seedance: 15 seconds (model maximum). Always use getMaxDuration(model) — never hardcode. Primary model: fal-ai/sora-2/image-to-video. Fallback: bytedance/seedance-2.0/fast/image-to-video. Switch via PREFERRED_VIDEO_MODEL env var — no code changes needed.
2. RLS enabled on ALL Supabase tables — never bypass, never use service role in client code
3. Credits deducted BEFORE pipeline starts — refunded on failure via credit_transactions
4. Never modify /lib/pipeline/ files directly unless the task explicitly says so
5. All DB access goes through /lib/db/ service functions — no raw Supabase queries in components
6. Never create new env vars without listing them at the end of your response
7. One responsibility per API route — no mega-routes
8. Always show a plan before writing code (files to create, files to modify, files to skip)

## Current build status
- [x] Phase 1 — Supabase schema + migrations
- [x] Phase 2 — Auth (magic link)
- [x] Phase 3 — Onboarding (4 steps)
- [x] Phase 4 — Dashboard
- [x] Phase 5 — Billing + Stripe
- [x] Phase 6 — Generate page + pipeline API
- [x] Phase 7 — Settings
- [x] Phase 8 — Cron autopilot

Update this checklist as phases complete.

## File map
/app                    → Next.js pages and API routes
/app/api/generate       → video pipeline trigger (POST, authenticated)
/app/api/billing        → Stripe checkout + webhook
/app/api/cron           → daily autopilot trigger
/app/(auth)             → login, auth/callback
/app/(app)              → dashboard, generate, settings, billing (protected)
/app/onboarding         → onboarding flow (protected, pre-dashboard)
/lib/db/                → all Supabase query functions
/lib/pipeline/          → video generation pipeline (FAL→Cloudinary→Submagic→Metricool)
/lib/stripe/            → Stripe helpers
/components/ui/         → Shadcn components only (do not modify)
/components/app/        → custom application components

## Design system
- Background: #0A0A0A (near black)
- Text: #FFFFFF
- Accent: #7C3AED (violet)
- Success: #16A34A
- Error: #DC2626
- Font: Inter
- Radius: rounded-xl on cards, rounded-lg on buttons
- No gradients on interactive elements — flat, high-contrast
- Skeleton loaders on all async states — no spinners
- Mobile-first responsive

## Pipeline order (do not reorder)
1. FAL AI — image generation (Nano Banana Pro)
2. Script prompt selection from project library
3. FAL AI — Sora 2 video (duration: 15, aspect_ratio: "9:16")
4. Cloudinary upload + upscale transformation
5. Submagic — burned-in captions + hook
6. Metricool — post to Instagram + Facebook
7. Update videos row → status: 'done'

## Pricing model — Monthly Subscription (NOT credits)
Three tiers managed via Stripe Subscriptions:

Starter  — $1,999/mo  → 30 videos/mo, 1 brand, 1 avatar, auto posting, analytics
Growth   — $3,499/mo  → 60 videos/mo, multi-avatar, multi-platform, comment/DM automation
Scale    — $5,000+/mo → unlimited queue, custom hooks engine, A/B testing, ad creatives

## Subscription logic
- No credits system — remove entirely
- Access gated by active Stripe subscription (check subscription status on each request)
- Video quota resets on billing cycle date (store in subscriptions table)
- Overage on Starter/Growth: block generation + show upgrade prompt
- Scale tier: no hard limit, queue-based generation

## Tables changed
- DELETE: credits, credit_transactions tables
- ADD: subscriptions table (user_id, tier, stripe_subscription_id, 
  videos_used_this_cycle, cycle_reset_date, status)

## Env vars (all set in Vercel + .env.local — do not rename)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
FAL_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
SUBMAGIC_API_KEY
METRICOOL_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
