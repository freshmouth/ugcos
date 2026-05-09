'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export type Timeframe = '7d' | '30d' | 'all'

const OPTIONS: { value: Timeframe; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
]

export function TimeframeSelector({ current }: { current: Timeframe }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function select(tf: Timeframe) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('timeframe', tf)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 mb-4">
      {OPTIONS.map(opt => {
        const active = current === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => select(opt.value)}
            className="px-3 py-[5px] rounded-[8px] text-[11px] font-semibold transition-all"
            style={{
              background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: active ? '#9D6BF5' : '#52525B',
              border: active ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
