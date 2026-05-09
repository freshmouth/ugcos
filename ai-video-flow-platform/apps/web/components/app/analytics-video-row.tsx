'use client'

import { useState } from 'react'

export interface VideoBreakdown {
  postId: string
  caption?: string
  views?: number
  hook_analysis: string
  content_pattern: string
  audience_trigger: string
  virality_factors: string[]
  recommended_followup: string
}

export interface AnalyticsReel {
  reelId: string
  rank: number
  caption: string
  views: number
  likes: number
  engagement: number
  date: string
  isViral: boolean
  thumbnail: string | null
  link: string | null
}

interface Props {
  reel: AnalyticsReel
  breakdown: VideoBreakdown | null
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toString()
}

export function AnalyticsVideoRow({ reel, breakdown }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div
        className="flex items-center gap-3 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Rank */}
        <div
          className="text-[13px] font-bold w-7 text-center flex-shrink-0"
          style={{ color: reel.rank <= 3 ? '#FBBF24' : '#3F3F46' }}
        >
          #{reel.rank}
        </div>

        {/* Thumbnail */}
        <div
          className="flex-shrink-0 rounded-[6px] overflow-hidden"
          style={{ width: 40, height: 72, background: '#1A1A1F', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {reel.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reel.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: 'linear-gradient(160deg,#2D1B69,#1a0a3b)' }} />
          )}
        </div>

        {/* Caption + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {reel.isViral && (
              <span
                className="text-[10px] font-bold px-[6px] py-[2px] rounded-[4px] flex-shrink-0"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                🔥 VIRAL
              </span>
            )}
          </div>
          <p className="text-[12px] truncate" style={{ color: '#A1A1AA' }}>
            {reel.caption.length > 60 ? reel.caption.slice(0, 60) + '…' : reel.caption || '—'}
          </p>
        </div>

        {/* Metrics */}
        <div className="hidden md:flex items-center gap-5 flex-shrink-0">
          <Metric label="views" value={formatNum(reel.views)} highlight={reel.isViral} />
          <Metric label="likes" value={formatNum(reel.likes)} />
          <Metric label="ER" value={reel.engagement.toFixed(1) + '%'} />
          <div className="text-[11px] w-14 text-right" style={{ color: '#52525B' }}>{reel.date}</div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {reel.link && (
            <a
              href={reel.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold px-[8px] py-[4px] rounded-[6px]"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#A1A1AA', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              ↗ View
            </a>
          )}
          {reel.isViral && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[11px] font-semibold px-[8px] py-[4px] rounded-[6px] transition-colors"
              style={{
                background: expanded ? 'rgba(124,58,237,0.25)' : 'rgba(124,58,237,0.1)',
                color: '#9D6BF5',
                border: '1px solid rgba(124,58,237,0.3)',
              }}
            >
              AI {expanded ? '▴' : '▾'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable AI Breakdown */}
      {expanded && (
        <div
          className="my-2 p-4 rounded-[10px]"
          style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.15)' }}
        >
          {breakdown ? (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <BreakdownItem label="Hook Analysis" value={breakdown.hook_analysis} />
                <BreakdownItem label="Content Pattern" value={breakdown.content_pattern} />
                <BreakdownItem label="Audience Trigger" value={breakdown.audience_trigger} />
                <BreakdownItem label="Recommended Follow-up" value={breakdown.recommended_followup} />
              </div>
              {breakdown.virality_factors?.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.5px] mb-2" style={{ color: '#7C3AED' }}>
                    Virality Factors
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {breakdown.virality_factors.map((f, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-[3px] rounded-full"
                        style={{ background: 'rgba(124,58,237,0.15)', color: '#C4B5FD' }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-2 text-center">
              <p className="text-[12px] mb-1" style={{ color: '#52525B' }}>
                AI breakdown not available for this video yet
              </p>
              <p className="text-[11px]" style={{ color: '#3F3F46' }}>
                Click &ldquo;Run Analysis&rdquo; in the insights panel below to generate
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[13px] font-bold" style={{ color: highlight ? '#FBBF24' : '#E4E4E7' }}>{value}</div>
      <div className="text-[10px]" style={{ color: '#52525B' }}>{label}</div>
    </div>
  )
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.5px] mb-1" style={{ color: '#7C3AED' }}>{label}</div>
      <p className="text-[12px] leading-[1.5]" style={{ color: '#A1A1AA' }}>{value}</p>
    </div>
  )
}
