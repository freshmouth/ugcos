interface Props {
  hookText: string
  timesUsed: number
  viewRate: string
  chartData?: number[]
}

export function HookCard({ hookText, timesUsed, viewRate, chartData = [30, 45, 35, 60, 55, 70, 65] }: Props) {
  const max = Math.max(...chartData)

  return (
    <div
      className="rounded-[16px] p-[18px]"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2 mb-[14px]">
        <span className="text-[16px]">🔥</span>
        <span className="text-[13px] font-bold">Top Performing Hook</span>
      </div>

      <div
        className="text-[16px] font-bold leading-[1.3] mb-[6px] tracking-[-0.3px]"
        style={{ color: '#FFFFFF' }}
      >
        &ldquo;{hookText}&rdquo;
      </div>

      <div className="text-[11px] mb-[14px]" style={{ color: '#52525B' }}>
        Used {timesUsed} times this month
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] mb-[3px]" style={{ color: '#52525B' }}>View-through rate</div>
          <div className="text-[20px] font-bold tracking-[-0.5px]">{viewRate}</div>
        </div>

        {/* Mini chart */}
        <svg width="80" height="36" viewBox="0 0 80 36">
          <polyline
            fill="none"
            stroke="#7C3AED"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={chartData.map((v, i) => {
              const x = (i / (chartData.length - 1)) * 72 + 4
              const y = 32 - (v / max) * 28
              return `${x},${y}`
            }).join(' ')}
          />
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            fill="url(#chartGrad)"
            points={[
              ...chartData.map((v, i) => {
                const x = (i / (chartData.length - 1)) * 72 + 4
                const y = 32 - (v / max) * 28
                return `${x},${y}`
              }),
              `${(chartData.length - 1) / (chartData.length - 1) * 72 + 4},36`,
              `4,36`,
            ].join(' ')}
          />
        </svg>
      </div>
    </div>
  )
}
