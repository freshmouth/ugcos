'use client'

import { useState, useEffect } from 'react'

export type ReelData = {
  reelId: string
  content?: string
  imageUrl?: string       // IG: Instagram CDN | FB: Metricool CDN (reliable)
  views?: number
  impressionsTotal?: number
  likes?: number
  engagement?: number
  durationSeconds?: number
  platform?: 'instagram' | 'facebook'
  link?: string | null    // post URL (IG or FB)
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toString()
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:15'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Props {
  reel: ReelData
  onClick?: (reel: ReelData) => void
}

export function ReelThumbCard({ reel, onClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const [supabaseThumb, setSupabaseThumb] = useState<string | null>(null)
  const [primaryFailed, setPrimaryFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  // Try to get a fal_image_url from our DB as fallback thumbnail
  useEffect(() => {
    fetch(`/api/videos/by-post-id?postId=${encodeURIComponent(reel.reelId)}`)
      .then(r => r.json())
      .then((data: { fal_image_url?: string }) => {
        if (data.fal_image_url) setSupabaseThumb(data.fal_image_url)
      })
      .catch(() => {})
  }, [reel.reelId])

  const views = reel.views ?? reel.impressionsTotal ?? 0
  const likes = reel.likes ?? 0
  const er = reel.engagement ?? 0
  const hookText = (reel.content ?? '').replace(/\n[\s\S]*/m, '').trim()
  const duration = formatDuration(reel.durationSeconds)

  // Cascade: reel.imageUrl → supabaseThumb → gradient
  const imgSrc = !primaryFailed
    ? (reel.imageUrl ?? null)
    : !fallbackFailed
      ? supabaseThumb
      : null

  // Post URL — construct fallback from reelId if link not provided
  const postLink = reel.link
    ?? (reel.platform === 'facebook'
      ? `https://www.facebook.com/${reel.reelId}/`
      : `https://www.instagram.com/p/${reel.reelId}/`)

  const platformLabel = reel.platform === 'facebook' ? 'Facebook' : 'Instagram'

  function handleClick() {
    if (onClick) { onClick(reel); return }
    if (postLink) window.open(postLink, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="cursor-pointer transition-transform duration-200"
      style={{ transform: hovered ? 'translateY(-3px)' : 'none' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      <div
        className="relative rounded-[12px] overflow-hidden mb-2"
        style={{
          aspectRatio: '9/16',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Gradient fallback — always behind */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg,#2D1B69 0%,#7C3AED 50%,#1a0a3b 100%)' }}
        />

        {/* Dark overlay */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 55%)' }}
        />

        {/* Thumbnail image */}
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => {
              if (!primaryFailed) setPrimaryFailed(true)
              else setFallbackFailed(true)
            }}
          />
        )}

        {/* Hover play overlay */}
        {hovered && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            {/* ▶ play button */}
            <div
              className="flex items-center justify-center rounded-full mb-2"
              style={{
                width: 40, height: 40,
                background: 'rgba(255,255,255,0.9)',
                fontSize: 16,
                paddingLeft: 3,
              }}
            >
              ▶
            </div>
            <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
              View on {platformLabel} →
            </span>
          </div>
        )}

        {/* External link icon on hover — top-right */}
        {hovered && (
          <div
            className="absolute top-2 right-2 z-30 text-[13px] font-bold"
            style={{ color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
          >
            ↗
          </div>
        )}

        {/* Platform badge — hidden on hover */}
        {!hovered && (
          <div
            className="absolute top-2 right-2 w-[18px] h-[18px] rounded-[3px] flex items-center justify-center text-white font-bold z-10"
            style={{ background: reel.platform === 'facebook' ? '#1877F2' : '#E1306C', fontSize: '8px' }}
          >
            {reel.platform === 'facebook' ? 'FB' : 'IG'}
          </div>
        )}

        {/* Sparkle */}
        <div className="absolute top-2 left-2 text-[10px] z-10" style={{ color: 'rgba(255,255,255,0.6)' }}>✦</div>

        {/* Hook text */}
        {hookText && !hovered && (
          <div
            className="absolute bottom-7 left-2 right-2 text-[11px] font-extrabold leading-tight z-10"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)', color: '#fff' }}
          >
            {hookText.length > 32 ? hookText.slice(0, 32) + '…' : hookText}
          </div>
        )}

        {/* Duration badge */}
        <div
          className="absolute bottom-[6px] right-[6px] text-[10px] font-semibold px-[6px] py-[2px] rounded-[4px] z-10"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
        >
          {duration}
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-[10px] mb-[3px]">
        <span className="text-[10px]" style={{ color: '#52525B' }}>↑ {formatNumber(views)}</span>
        <span className="text-[10px]" style={{ color: '#52525B' }}>♡ {formatNumber(likes)}</span>
        <span className="text-[10px]" style={{ color: '#52525B' }}>◎ {er.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-[5px] text-[11px] font-medium">
        <div
          className="w-4 h-4 rounded-[3px] flex items-center justify-center text-[9px] font-bold text-white"
          style={{ background: reel.platform === 'facebook' ? '#1877F2' : '#E1306C' }}
        >
          {reel.platform === 'facebook' ? 'FB' : 'IG'}
        </div>
        <span style={{ color: '#22C55E' }}>Posted</span>
      </div>
    </div>
  )
}
