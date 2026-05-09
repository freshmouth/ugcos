import { createBrowserClient } from '@supabase/ssr'

// createBrowserClient from @supabase/ssr uses cookies by default,
// which is required for the SSR middleware to see the session.
// Do NOT override auth.storage with localStorage — that breaks the middleware.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
