'use client'

import { useState } from 'react'

interface Props {
  src: string | null | undefined
  platform: 'instagram' | 'facebook'
  hookText: string | null | undefined
  status: 'posted' | 'progress' | 'upcoming'
  impressions: number
  engagementRate: number | null | undefined
  index: number
}

const GRADIENTS = [
  'linear-gradient(135deg,#1a0a2e,#3b1a6b)',
  'linear-gradient(135deg,#0a1a2e,#1a3b6b)',
  'linear-gradient(135deg,#1a2e0a,#3b6b1a)',
  'linear-gradient(135deg,#2e0a1a,#6b1a3b)',
  'linear-gradient(135deg,#0a2e2e,#1a6b6b)',
]

export function MetricoolThumb({ src, platform, hookText, status, impressions, engagementRate, index }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const gradient = GRADIENTS[index % GRADIENTS.length]!
  const isIG = platform === 'instagram'

  return (
    <div className="cursor-pointer group">
      <div
        className="relative rounded-[12px] overflow-hidden mb-2"
        style={{ aspectRatio: '9/16', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Gradient placeholder always rendered behind */}
        <div className="absolute inset-0" style={{ background: gradient }}>
          <div className="w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 20 20" fill="currentColor" width="24" height="24" style={{ color: 'rgba(255,255,255,0.15)' }}>
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Image on top — hidden on error */}
        {src && !imgFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}

        {/* Status badge */}
        <div
          className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-[2px]"
          style={{
            background: status === 'posted' ? 'rgba(34,197,94,0.15)' : status === 'progress' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${status === 'posted' ? 'rgba(34,197,94,0.3)' : status === 'progress' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.15)'}`,
          }}
        >
          <div
            className="w-[5px] h-[5px] rounded-full"
            style={{ background: status === 'posted' ? '#22C55E' : status === 'progress' ? '#F59E0B' : '#A1A1AA' }}
          />
          <span style={{ fontSize: '9px', fontWeight: 600, color: status === 'posted' ? '#22C55E' : status === 'progress' ? '#F59E0B' : '#A1A1AA' }}>
            {status === 'posted' ? 'Posted' : status === 'progress' ? 'Sending' : 'Scheduled'}
          </span>
        </div>

        {/* Platform icon */}
        <div
          className="absolute top-2 right-2 flex items-center justify-center rounded-[4px] text-white font-bold"
          style={{ width: '18px', height: '18px', background: isIG ? '#E1306C' : '#1877F2', fontSize: '8px' }}
        >
          {isIG ? 'IG' : 'FB'}
        </div>

        {/* Hook text overlay */}
        {hookText && (
          <div
            className="absolute bottom-0 left-0 right-0 px-2 py-2"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
              fontSize: '9px',
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.3,
            }}
          >
            {hookText.length > 42 ? hookText.slice(0, 42) + '…' : hookText}
          </div>
        )}
      </div>

      {/* Metrics below */}
      <div className="flex items-center justify-between" style={{ fontSize: '10px', color: '#52525B' }}>
        <span>{impressions > 0 ? impressions.toLocaleString() + ' views' : '—'}</span>
        <span>{engagementRate ? `${engagementRate.toFixed(1)}%` : '—'}</span>
      </div>
    </div>
  )
}
