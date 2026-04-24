# AI Video Flow Platform — Master Context

## What this is
Multi-tenant SaaS. Users sign up, onboard their product, and the platform
automatically generates 15-second short-form videos and posts them to Instagram
and Facebook daily via autopilot. Credits system: 30 credits = 1 video = $10 USD.

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
1. Video duration is ALWAYS 15 seconds — pass duration: 15 explicitly, never rely on defaults
2. RLS enabled on ALL Supabase tables — never bypass, never use service role in client code
3. Credits deducted BEFORE pipeline starts — refunded on failure via credit_transactions
4. Never modify /lib/pipeline/ files directly unless the task explicitly says so
5. All DB access goes through /lib/db/ service functions — no raw Supabase queries in components
6. Never create new env vars without listing them at the end of your response
7. One responsibility per API route — no mega-routes
8. Always show a plan before writing code (files to create, files to modify, files to skip)

## Current build status
- [ ] Phase 1 — Supabase schema + migrations
- [ ] Phase 2 — Auth (magic link)
- [ ] Phase 3 — Onboarding (4 steps)
- [ ] Phase 4 — Dashboard
- [ ] Phase 5 — Billing + Stripe
- [ ] Phase 6 — Generate page + pipeline API
- [ ] Phase 7 — Settings
- [ ] Phase 8 — Cron autopilot

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

## Credit flow
- Signup trigger → 30 credits free (1 video)
- Generate → deduct 30 credits → run pipeline → on fail: refund 30 credits
- Top up → Stripe checkout → webhook → add credits to balance

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
