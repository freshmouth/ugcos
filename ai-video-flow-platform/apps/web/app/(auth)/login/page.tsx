'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const origin = window.location.origin
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    })

    setLoading(false)
    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#0A0A0A' }}>
      <div className="w-full max-w-sm rounded-xl p-8" style={{ background: '#111111' }}>
        <div className="mb-6 text-center">
          <div className="mb-4 text-2xl font-bold text-white">▶ AI Video Flow</div>
          <h1 className="text-2xl font-semibold text-white">Sign in to AI Video Flow</h1>
          <p className="mt-1 text-sm" style={{ color: '#9CA3AF' }}>
            We&apos;ll send you a magic link — no password needed
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg p-6 text-center" style={{ background: '#1A1A1A' }}>
            <div className="mb-2 text-3xl">✉️</div>
            <p className="font-medium text-white">Check your inbox for a magic link</p>
            <p className="mt-1 text-sm" style={{ color: '#9CA3AF' }}>
              We sent a link to {email}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="h-12 w-full rounded-lg border px-4 text-white outline-none focus:border-violet-500"
                style={{ background: '#1A1A1A', borderColor: '#374151' }}
              />
              {error && <p className="mt-1 text-sm" style={{ color: '#DC2626' }}>{error}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#7C3AED' }}
            >
              {loading ? 'Sending...' : 'Send me a magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
