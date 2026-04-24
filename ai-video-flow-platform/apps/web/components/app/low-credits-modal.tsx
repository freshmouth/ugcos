'use client'

import { useState } from 'react'
import { CREDIT_PACKAGES } from '@/lib/stripe/packages'

export function LowCreditsModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState('')

  async function handleBuy(packageId: string) {
    setLoading(packageId)
    const res = await fetch('/api/billing/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_id: packageId }),
    })
    const data = await res.json()
    setLoading('')
    if (data.url) window.location.href = data.url
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#111111' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Not enough credits</h3>
          <button onClick={onClose} style={{ color: '#9CA3AF' }} className="text-xl">×</button>
        </div>
        <p className="mb-6 text-sm" style={{ color: '#9CA3AF' }}>
          You need 30 credits to generate a video. Add credits to continue.
        </p>
        <div className="space-y-3">
          {CREDIT_PACKAGES.map(pkg => (
            <div key={pkg.id} className="flex items-center justify-between rounded-xl border p-4" style={{ borderColor: '#374151' }}>
              <div>
                <div className="font-semibold text-white">{pkg.label}</div>
                <div className="text-sm" style={{ color: '#9CA3AF' }}>{pkg.credits} credits · {pkg.description}</div>
              </div>
              <button
                onClick={() => handleBuy(pkg.id)}
                disabled={loading === pkg.id}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: '#7C3AED' }}
              >
                {loading === pkg.id ? '...' : `$${pkg.price}`}
              </button>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full text-sm" style={{ color: '#6B7280' }}>Cancel</button>
      </div>
    </div>
  )
}
