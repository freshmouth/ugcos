'use client'

export function LowCreditsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: '#111111' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Monthly quota reached</h3>
          <button onClick={onClose} style={{ color: '#9CA3AF' }} className="text-xl">×</button>
        </div>
        <p className="mb-6 text-sm" style={{ color: '#9CA3AF' }}>
          You&apos;ve used all your videos for this billing cycle. Upgrade your plan to generate more videos.
        </p>
        <a
          href="/billing"
          className="block w-full rounded-lg py-2.5 text-center font-semibold text-white"
          style={{ background: '#7C3AED' }}
        >
          View Plans
        </a>
        <button onClick={onClose} className="mt-3 w-full text-sm" style={{ color: '#6B7280' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
