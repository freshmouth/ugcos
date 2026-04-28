interface Props {
  insight: string
  onViewMore?: () => void
}

export function InsightsCard({ insight, onViewMore }: Props) {
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

      <p
        className="text-[12px] leading-[1.6] mb-3"
        style={{ color: '#A1A1AA' }}
      >
        {insight}
      </p>

      <button
        className="text-[11px] font-semibold"
        style={{ color: '#9D6BF5' }}
        onClick={onViewMore}
        onMouseEnter={e => ((e.target as HTMLElement).style.textDecoration = 'underline')}
        onMouseLeave={e => ((e.target as HTMLElement).style.textDecoration = 'none')}
      >
        View full report →
      </button>
    </div>
  )
}
