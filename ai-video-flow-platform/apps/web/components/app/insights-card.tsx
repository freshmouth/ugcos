import Link from 'next/link'

interface Props {
  insight?: string | null
  recommendedHook?: string | null
}

export function InsightsCard({ insight, recommendedHook }: Props) {
  return (
    <div
      className="rounded-[16px] p-[18px]"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2 mb-[10px]">
        <div
          className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[12px] flex-shrink-0"
          style={{ background: 'rgba(124,58,237,0.15)' }}
        >
          ✨
        </div>
        <span className="text-[13px] font-bold">AI Insights</span>
      </div>

      {insight && (
        <p className="text-[12px] leading-[1.6] mb-3" style={{ color: '#A1A1AA' }}>
          {insight}
        </p>
      )}

      {recommendedHook && (
        <div
          className="rounded-[10px] px-3 py-[10px] mb-3"
          style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}
        >
          <div className="text-[9px] font-bold uppercase tracking-[0.8px] mb-1" style={{ color: '#7C3AED' }}>
            Next hook to use
          </div>
          <p className="text-[12px] font-semibold leading-[1.4]" style={{ color: '#C4B5FD' }}>
            &ldquo;{recommendedHook}&rdquo;
          </p>
        </div>
      )}

      {!insight && !recommendedHook && (
        <p className="text-[12px] leading-[1.6] mb-3" style={{ color: '#52525B' }}>
          Run analysis to get AI-powered insights about your best performing content.
        </p>
      )}

      <Link
        href="/analytics"
        className="text-[11px] font-semibold hover:underline"
        style={{ color: '#9D6BF5' }}
      >
        View full report →
      </Link>
    </div>
  )
}
