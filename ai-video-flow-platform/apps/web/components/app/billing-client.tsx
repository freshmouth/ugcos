'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CREDIT_PACKAGES } from '@/lib/stripe/packages'

type Transaction = {
  id: string
  amount: number
  reason: string
  created_at: string
}

interface Props {
  balance: number
  transactions: Transaction[]
  showSuccess: boolean
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case 'signup_bonus': return 'Welcome bonus 🎁'
    case 'purchase': return 'Top up'
    case 'video_generated': return 'Video generated'
    case 'refund': return 'Refund'
    default: return reason
  }
}

export function BillingClient({ balance, transactions, showSuccess }: Props) {
  const router = useRouter()
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState<string>('')
  const didToast = useRef(false)

  useEffect(() => {
    if (showSuccess && !didToast.current) {
      didToast.current = true
      setToast('Credits added! 🎉')
      router.replace('/billing')
      setTimeout(() => setToast(''), 4000)
    }
  }, [showSuccess, router])

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

  const videosRemaining = Math.floor(balance / 30)
  const progressPct = Math.min((balance / 360) * 100, 100)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">Billing & Credits</h1>

      {toast && (
        <div className="mb-4 rounded-xl p-4 text-sm font-medium text-white" style={{ background: '#7C3AED' }}>
          {toast}
        </div>
      )}

      {/* Balance */}
      <div className="mb-8 rounded-xl border p-6" style={{ background: '#111111', borderColor: '#1F2937' }}>
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl">🪙</span>
          <div>
            <div className="text-3xl font-bold text-white">{balance} credits</div>
            <div className="text-sm" style={{ color: '#9CA3AF' }}>= {videosRemaining} video{videosRemaining !== 1 ? 's' : ''} remaining</div>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#1F2937' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: '#7C3AED' }} />
        </div>
      </div>

      {/* Packages */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-white">Add Credits</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {CREDIT_PACKAGES.map(pkg => (
            <div key={pkg.id} className="relative rounded-xl border p-6 transition-colors hover:border-violet-500" style={{ background: '#111111', borderColor: '#1F2937' }}>
              {'badge' in pkg && pkg.badge && (
                <div className="absolute -top-2 left-4 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: '#7C3AED' }}>
                  {pkg.badge}
                </div>
              )}
              <div className="mb-1 text-lg font-bold text-white">{pkg.label}</div>
              <div className="mb-1 text-2xl font-bold text-white">{pkg.credits} credits</div>
              <div className="mb-4 text-sm" style={{ color: '#9CA3AF' }}>{pkg.description}</div>
              <div className="mb-4 text-xl font-bold text-white">${pkg.price} USD</div>
              <button
                onClick={() => handleBuy(pkg.id)}
                disabled={loading === pkg.id}
                className="w-full rounded-lg py-2.5 font-semibold text-white disabled:opacity-60 hover:opacity-90"
                style={{ background: '#7C3AED' }}
              >
                {loading === pkg.id ? 'Loading...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-white">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="rounded-xl border py-10 text-center" style={{ background: '#111111', borderColor: '#1F2937' }}>
            <p style={{ color: '#6B7280' }}>No transactions yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border" style={{ background: '#111111', borderColor: '#1F2937' }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #1F2937' }}>
                  {['Date', 'Type', 'Credits', 'Balance After'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom: i < transactions.length - 1 ? '1px solid #1F2937' : 'none' }}>
                    <td className="px-4 py-3 text-sm text-white">{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm text-white">{reasonLabel(tx.reason)}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: tx.amount > 0 ? '#4ADE80' : '#F87171' }}>
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount} credits
                    </td>
                    <td className="px-4 py-3 text-sm text-white">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
