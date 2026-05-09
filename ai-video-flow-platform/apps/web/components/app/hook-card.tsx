type TopHook = { text: string; avg_views: number; why_it_works: string }

interface Props {
  topHooks?: TopHook[]
  // fallback when no AI insights yet
  hookText?: string | null
  timesUsed?: number
  viewRate?: string
  chartData?: number[]
  postsAnalyzed?: number | null
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toString()
}

export function HookCard({
  topHooks = [],
  hookText = null,
  timesUsed = 0,
  viewRate = '—',
  chartData = [30, 45, 35, 60, 55, 70, 65],
  postsAnalyzed,
}: Props) {
  const hasInsights = topHooks.length > 0

  return (
    <div
      className="rounded-[16px] p-[18px]"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2 mb-[14px]">
        <span className="text-[16px]">🔥</span>
        <span className="text-[13px] font-bold">Top Performing Hooks</span>
        {postsAnalyzed != null && (
          <span className="ml-auto text-[10px]" style={{ color: '#52525B' }}>
            From {postsAnalyzed} posts
          </span>
        )}
      </div>

      {hasInsights ? (
        <div className="flex flex-col gap-[10px]">
          {topHooks.slice(0, 3).map((hook, i) => (
            <div
              key={i}
              className="rounded-[10px] p-[10px]"
              style={{
                background: i === 0 ? 'rgba(124,58,237,0.08)' : '#0F0F12',
                border: `1px solid ${i === 0 ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)'}`,
              }}
            >
              <div className="flex items-start gap-[8px]">
                {/* Rank circle */}
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    width: 20,
                    height: 20,
                    background: i === 0 ? '#7C3AED' : 'rgba(255,255,255,0.08)',
                    color: i === 0 ? '#fff' : '#71717A',
                  }}
                >
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className="text-[12px] font-semibold leading-[1.4]"
                    style={{ color: '#E4E4E7' }}
                  >
                    &ldquo;{hook.text}&rdquo;
                  </p>
                  <div className="flex items-center gap-[6px] mt-[4px]">
                    <span className="text-[11px] font-bold" style={{ color: i === 0 ? '#9D6BF5' : '#A1A1AA' }}>
                      {formatViews(hook.avg_views)} avg views
                    </span>
                  </div>
                  {hook.why_it_works && (
                    <p className="text-[10px] mt-[4px] leading-[1.4]" style={{ color: '#52525B' }}>
                      {hook.why_it_works}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : hookText === null ? (
        <p className="text-[12px] leading-[1.6]" style={{ color: '#52525B' }}>
          Generate your first video to see hook performance
        </p>
      ) : (
        <>
          <div
            className="text-[15px] font-bold leading-[1.3] mb-[6px] tracking-[-0.3px]"
            style={{ color: '#FFFFFF' }}
          >
            &ldquo;{hookText}&rdquo;
          </div>

          <div className="text-[11px] mb-[14px]" style={{ color: '#52525B' }}>
            {`Used ${timesUsed} time${timesUsed === 1 ? '' : 's'} this month`}
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] mb-[3px]" style={{ color: '#52525B' }}>View-through rate</div>
              <div className="text-[20px] font-bold tracking-[-0.5px]">{viewRate}</div>
            </div>

            <svg width="80" height="36" viewBox="0 0 80 36">
              {(() => {
                const max = Math.max(...chartData, 1)
                const points = chartData.map((v, idx) => {
                  const x = (idx / (chartData.length - 1)) * 72 + 4
                  const y = 32 - (v / max) * 28
                  return `${x},${y}`
                })
                return (
                  <>
                    <polyline
                      fill="none"
                      stroke="#7C3AED"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={points.join(' ')}
                    />
                    <defs>
                      <linearGradient id="hookChartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon
                      fill="url(#hookChartGrad)"
                      points={[
                        ...points,
                        `${(chartData.length - 1) / (chartData.length - 1) * 72 + 4},36`,
                        `4,36`,
                      ].join(' ')}
                    />
                  </>
                )
              })()}
            </svg>
          </div>
        </>
      )}
    </div>
  )
}
