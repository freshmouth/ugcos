'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe/packages'
import type { Subscription } from '@/lib/db/subscriptions'

interface Props {
  subscription: Subscription | null
  showSubscribed: boolean
}

export function BillingClient({ subscription, showSubscribed }: Props) {
  const router = useRouter()
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const didToast = useRef(false)

  useEffect(() => {
    if (showSubscribed && !didToast.current) {
      didToast.current = true
      setToast("Welcome to AI Video Flow 🎉 Let's make your first video.")
      router.replace('/billing')
      setTimeout(() => setToast(''), 5000)
    }
  }, [showSubscribed, router])

  async function handleSubscribe(tierId: string) {
    setLoading(tierId)
    const res = await fetch('/api/billing/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier_id: tierId }),
    })
    const data = await res.json()
    setLoading('')
    if (data.url) window.location.href = data.url
  }

  async function handlePortal() {
    setPortalLoading(true)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    setPortalLoading(false)
    if (data.url) window.location.href = data.url
  }

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const isPastDue = subscription?.status === 'past_due'
  const isCanceled = subscription?.status === 'canceled'
  const showPricing = !subscription || isCanceled

  const activeTier = SUBSCRIPTION_TIERS.find(t => t.id === subscription?.tier)
  const used = subscription?.videos_used_this_cycle ?? 0
  const limit = subscription?.videos_limit
  const usagePct = limit ? Math.min((used / limit) * 100, 100) : 0
  const resetDate = subscription?.cycle_reset_date
    ? new Date(subscription.cycle_reset_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">Billing & Subscription</h1>

      {toast && (
        <div className="mb-4 rounded-xl p-4 text-sm font-medium text-white" style={{ background: '#7C3AED' }}>
          {toast}
        </div>
      )}

      {/* Past due warning */}
      {isPastDue && (
        <div className="mb-6 rounded-xl border p-4" style={{ background: 'rgba(220,38,38,0.1)', borderColor: '#DC2626' }}>
          <div className="mb-2 font-semibold text-white">Payment failed — update your payment method to restore access</div>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: '#DC2626' }}
          >
            {portalLoading ? 'Loading...' : 'Update Payment Method'}
          </button>
        </div>
      )}

      {/* Active / past-due plan card */}
      {(isActive || isPastDue) && activeTier && (
        <div className="mb-8 rounded-xl border p-6" style={{ background: '#111111', borderColor: '#1F2937' }}>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#6B7280' }}>Current Plan</div>
              <div className="text-2xl font-bold text-white">{activeTier.label}</div>
              <div className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
                ${activeTier.price.toLocaleString()}/month
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: isPastDue ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)',
                color: isPastDue ? '#F87171' : '#4ADE80',
              }}
            >
              {isPastDue ? 'Past Due' : subscription?.status === 'trialing' ? 'Trial' : 'Active'}
            </span>
          </div>

          {/* Usage */}
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-sm">
              <span style={{ color: '#9CA3AF' }}>Videos this cycle</span>
              <span className="font-semibold text-white">
                {used} / {limit === null ? '∞' : limit}
              </span>
            </div>
            {limit !== null && (
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#1F2937' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${usagePct}%`, background: '#7C3AED' }}
                />
              </div>
            )}
            {resetDate && (
              <div className="mt-1 text-xs" style={{ color: '#6B7280' }}>Resets {resetDate}</div>
            )}
          </div>

          {subscription?.cancel_at_period_end && (
            <div className="mb-4 rounded-lg p-3 text-sm" style={{ background: 'rgba(220,38,38,0.1)', color: '#F87171' }}>
              Your subscription will cancel at the end of the current period.
            </div>
          )}

          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
            style={{ background: '#374151' }}
          >
            {portalLoading ? 'Loading...' : 'Manage Subscription'}
          </button>
        </div>
      )}

      {/* Pricing cards */}
      {showPricing && (
        <div>
          {isCanceled && (
            <p className="mb-4 text-sm" style={{ color: '#9CA3AF' }}>
              Your subscription ended. Resubscribe below to continue generating videos.
            </p>
          )}
          <div className="grid gap-5 md:grid-cols-3">
            {SUBSCRIPTION_TIERS.map(tier => (
              <div
                key={tier.id}
                className="relative rounded-xl border p-6 transition-colors"
                style={{
                  background: '#111111',
                  borderColor: tier.highlighted ? '#7C3AED' : '#1F2937',
                }}
              >
                {tier.highlighted && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white"
                    style={{ background: '#7C3AED' }}
                  >
                    Most Popular
                  </div>
                )}
                <div className="mb-1 text-lg font-bold text-white">{tier.label}</div>
                <div className="mb-1 text-3xl font-bold text-white">
                  ${tier.price.toLocaleString()}
                  <span className="text-base font-normal" style={{ color: '#9CA3AF' }}>/mo</span>
                </div>
                <div className="mb-4 text-sm" style={{ color: '#6B7280' }}>
                  {tier.videosPerMonth === null ? 'Unlimited videos' : `${tier.videosPerMonth} videos/month`}
                </div>
                <ul className="mb-6 space-y-2">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: '#D1D5DB' }}>
                      <span className="mt-0.5 text-xs" style={{ color: '#7C3AED' }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={loading === tier.id}
                  className="w-full rounded-lg py-2.5 font-semibold text-white disabled:opacity-60 hover:opacity-90"
                  style={{ background: tier.highlighted ? '#7C3AED' : '#374151' }}
                >
                  {loading === tier.id ? 'Loading...' : 'Get Started'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscription history */}
      {isActive && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-white">Subscription Details</h2>
          <div className="rounded-xl border p-5" style={{ background: '#111111', borderColor: '#1F2937' }}>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt style={{ color: '#6B7280' }}>Plan</dt>
                <dd className="font-medium text-white">{activeTier?.label}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: '#6B7280' }}>Status</dt>
                <dd className="font-medium" style={{ color: '#4ADE80' }}>Active</dd>
              </div>
              {resetDate && (
                <div className="flex justify-between">
                  <dt style={{ color: '#6B7280' }}>Next billing date</dt>
                  <dd className="font-medium text-white">{resetDate}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt style={{ color: '#6B7280' }}>Videos limit</dt>
                <dd className="font-medium text-white">
                  {limit === null ? 'Unlimited' : `${limit} per month`}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
