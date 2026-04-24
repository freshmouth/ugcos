# Environment Variables Reference

## Rule for Claude
DO NOT create new env vars without flagging it explicitly.
DO NOT rename existing env vars.
All vars below are already set in Vercel and .env.local.

## Supabase
NEXT_PUBLIC_SUPABASE_URL          — public, use in browser + server
NEXT_PUBLIC_SUPABASE_ANON_KEY     — public, safe for browser (RLS enforces security)
SUPABASE_SERVICE_ROLE_KEY         — PRIVATE, server-only, bypasses RLS
                                    Only use in: webhook routes, cron route

## FAL AI
FAL_KEY                           — server-only

## Cloudinary
CLOUDINARY_CLOUD_NAME             — server-only
CLOUDINARY_API_KEY                — server-only
CLOUDINARY_API_SECRET             — server-only

## Submagic
SUBMAGIC_API_KEY                  — server-only

## Metricool
METRICOOL_API_KEY                 — server-only

## Stripe
STRIPE_SECRET_KEY                 — server-only
STRIPE_WEBHOOK_SECRET             — server-only (used only in webhook route)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — public, used in client for Stripe.js

## App
NEXT_PUBLIC_SITE_URL              — public, set to https://your-domain.com in prod

## Cron (added in Phase 8)
CRON_SECRET                       — server-only, used to authenticate cron requests

## Notes
- NEXT_PUBLIC_ prefix = safe to expose to browser
- All others = server-only, never import in client components
- Use process.env.VAR_NAME in server code
- Use NEXT_PUBLIC vars in client code or server components
