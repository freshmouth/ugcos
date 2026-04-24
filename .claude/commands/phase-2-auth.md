# Phase 2 — Auth: Magic Link

## Pre-flight check
Before writing anything:
1. Confirm Phase 1 schema is complete (profiles table exists)
2. List every file you will create and every file you will modify
3. Wait for approval before writing code

## Context
- Auth provider: Supabase magic link (email OTP) — no passwords
- Session management: Supabase SSR (@supabase/ssr package)
- Protected routes: /dashboard, /generate, /settings, /billing, /onboarding
- Public routes: /, /login, /auth/callback

## Files to create

### /app/(auth)/login/page.tsx
Clean, minimal login page.
- Single email input, centered layout
- "Send me a magic link" submit button (accent color: #7C3AED)
- On submit: call supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } })
- Show two states: form state + confirmation state ("Check your inbox for a magic link ✉️")
- No navigation, no header — just the form and logo
- Error state if email invalid or rate limited

### /app/auth/callback/route.ts
Supabase auth callback handler.
```typescript
// Exchange code for session
// Check profiles.onboarding_done for this user
// If onboarding_done = false → redirect to /onboarding
// If onboarding_done = true  → redirect to /dashboard
// On error → redirect to /login?error=auth_failed
```

### /middleware.ts
Protect all app routes.
```typescript
// Use createMiddlewareClient from @supabase/ssr
// Public paths: ['/', '/login', '/auth/callback']
// If no session and path is protected → redirect to /login
// If session exists and path is /login → redirect to /dashboard
// Always refresh session on every request
```

### /lib/supabase/
Three Supabase client helpers (standard SSR pattern):
- client.ts    → createBrowserClient (use in client components)
- server.ts    → createServerClient with cookies (use in server components + route handlers)
- middleware.ts → createMiddlewareClient (use in middleware only)

## Supabase config to set
In the Supabase dashboard → Auth → URL Configuration:
- Site URL: https://your-domain.com
- Redirect URLs: https://your-domain.com/auth/callback

Note: Do not hardcode these URLs. Use NEXT_PUBLIC_SITE_URL env var.

## New env var needed
NEXT_PUBLIC_SITE_URL=http://localhost:3000  (set to production URL in Vercel)

## Login page design spec
```
Background: #0A0A0A full screen
Center card: max-w-sm, bg #111111, rounded-xl, p-8
Logo: top center (text or SVG placeholder)
Heading: "Sign in to AI Video Flow" — white, text-2xl, font-semibold
Subheading: "We'll send you a magic link — no password needed" — gray-400, text-sm
Input: full width, bg #1A1A1A, border border-gray-700, text-white, rounded-lg, h-12
Button: full width, bg #7C3AED, text-white, font-semibold, rounded-lg, h-12
  Loading state: show spinner + "Sending..." text, disabled
Confirmation state: replace form with checkmark icon + message
Error state: red text below input field
```

## After completing this phase
1. Test magic link flow locally
2. Confirm redirect to /onboarding for new users
3. Confirm redirect to /dashboard for returning users (once dashboard exists, else just confirm session)
4. Confirm middleware blocks /dashboard without session
5. Update CLAUDE.md Phase 2 checkbox to [x]
6. git commit -m "checkpoint: auth complete"

## Do NOT do in this phase
- No dashboard UI
- No onboarding UI
- No database queries beyond the auth callback profile check
