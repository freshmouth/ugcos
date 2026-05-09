'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const done = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    function go(path: string) {
      if (done.current) return
      done.current = true
      router.replace(path)
    }

    async function handle() {
      const url = new URL(window.location.href)

      // PKCE flow: Supabase redirected with ?code=
      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        go(error ? '/login?error=auth_failed' : '/dashboard')
        return
      }

      // OTP flow: ?token_hash= + ?type=
      const token_hash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type')
      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          type: type as 'magiclink' | 'email' | 'recovery' | 'invite',
          token_hash,
        })
        go(error ? '/login?error=auth_failed' : '/dashboard')
        return
      }

      // Implicit / hash flow: #access_token= — Supabase detects it automatically
      // via detectSessionInUrl. Listen for the resulting event.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          go('/dashboard')
        }
      })

      // Also check immediately — might already be parsed
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        subscription.unsubscribe()
        go('/dashboard')
        return
      }

      // Final fallback after 4 s
      const timeout = setTimeout(async () => {
        const { data: { session: s } } = await supabase.auth.getSession()
        subscription.unsubscribe()
        go(s ? '/dashboard' : '/login?error=auth_failed')
      }, 4000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timeout)
      }
    }

    handle()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0C0C0F',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid #7C3AED',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <p style={{ color: '#A1A1AA', fontSize: 14 }}>Signing you in...</p>
    </div>
  )
}
