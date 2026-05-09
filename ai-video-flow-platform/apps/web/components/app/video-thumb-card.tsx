'use client'

import { useState } from 'react'

type VideoThumb = {
  id: string
  status: string
  content_type: string | null
  captioned_url: string | null
  cloudinary_url: string | null
  fal_image_url?: string | null
  created_at: string
  hook_text?: string | null
  qa_image_score?: number | null
  qa_video_score?: number | null
  qa_warning?: string | null
}

// Convert a Cloudinary video URL to a static JPEG thumbnail frame.
// Finds the stable /v{version}/{public_id}.ext path and reconstructs with image transformation.
function cloudinaryVideoThumb(videoUrl: string | null): string | null {
  if (!videoUrl?.includes('cloudinary.com/')) return null
  const cloudNameMatch = videoUrl.match(/cloudinary\.com\/([^/]+)\//)
  if (!cloudNameMatch) return null
  const cloudName = cloudNameMatch[1]!

  // The last /v{digits}/ in the URL marks where the stable public_id begins
  const vMatch = videoUrl.match(/\/(v\d+\/[^?]+)\.\w{2,4}(\?|$)/)
  if (!vMatch) return null
  const versionedPath = vMatch[1]!

  return `https://res.cloudinary.com/${cloudName}/video/upload/c_fill,w_225,h_400,so_1/${versionedPath}.jpg`
}

// Content-type gradient map per spec
const CONTENT_GRADIENTS: Record<string, string> = {
  viral:          'linear-gradient(160deg,#1a1a3a,#0a0a1a)',
  shocking:       'linear-gradient(160deg,#2a0a0a,#1a0505)',
  informative:    'linear-gradient(160deg,#0a1a2a,#050a15)',
  emotional:      'linear-gradient(160deg,#1a0a2a,#0a0515)',
  scroll_stopper: 'linear-gradient(160deg,#1a0a0a,#150505)',
}
const DEFAULT_GRADIENT = 'linear-gradient(160deg,#141418,#0c0c0f)'

interface Props {
  video: VideoThumb
  index: number
  onClick?: (video: VideoThumb) => void
}

export function VideoThumbCard({ video, index, onClick }: Props) {
  const [hovered, setHovered] = useState(false)
  // Priority: cloudinary thumb → fal_image_url → gradient
  const [primaryFailed, setPrimaryFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const primarySrc = cloudinaryVideoThumb(video.captioned_url || video.cloudinary_url)
  const fallbackSrc = video.fal_image_url || null
  const imgSrc = !primaryFailed ? primarySrc : !fallbackFailed ? fallbackSrc : null

  const gradient = CONTENT_GRADIENTS[video.content_type ?? ''] ?? DEFAULT_GRADIENT
  const hookText = video.hook_text ?? video.content_type ?? 'Video'
  const isDone = video.status === 'done'

  const qaScore = video.qa_video_score ?? null
  const qaColor = qaScore === null ? null : qaScore >= 7 ? '#16A34A' : qaScore >= 5 ? '#D97706' : '#DC2626'
  const qaLabel = qaScore !== null ? `QA ${qaScore.toFixed(1)}` : null

  void index // index kept for API compatibility

  return (
    <div
      className="cursor-pointer transition-transform duration-200"
      style={{ transform: hovered ? 'translateY(-3px)' : 'translateY(0)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick?.(video)}
    >
      <div
        className="w-full rounded-[12px] overflow-hidden relative mb-2"
        style={{ aspectRatio: '9/16', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {/* Gradient — always rendered behind as fallback */}
        <div className="absolute inset-0" style={{ background: gradient }} />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.75) 0%,rgba(0,0,0,0) 55%)' }}
        />

        {/* Image on top */}
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

        {/* Sparkle */}
        <div className="absolute top-2 left-2 text-[10px] z-10" style={{ color: 'rgba(255,255,255,0.6)' }}>✦</div>

        {/* QA score badge */}
        {qaLabel && (
          <div
            className="absolute top-2 right-2 text-[9px] font-bold px-[5px] py-[2px] rounded-[4px] z-10"
            style={{ background: qaColor!, color: '#fff', opacity: 0.9 }}
            title={video.qa_warning ?? undefined}
          >
            {qaLabel}{video.qa_warning ? ' ⚠' : ''}
          </div>
        )}

        {/* Hook text */}
        <div
          className="absolute bottom-7 left-2 right-2 text-[11px] font-extrabold leading-tight z-10"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)', color: '#fff' }}
        >
          {hookText.length > 32 ? hookText.slice(0, 32) + '…' : hookText}
        </div>

        {/* Duration badge */}
        <div
          className="absolute bottom-[6px] right-[6px] text-[10px] font-semibold px-[6px] py-[2px] rounded-[4px] z-10"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
        >
          0:15
        </div>

        {/* In-progress overlay */}
        {!isDone && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-[12px] z-20"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.8)', color: '#fff' }}>
              {video.status}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-1">
        <div className="flex gap-[6px]">
          <span className="text-[10px]" style={{ color: '#52525B' }}>↑ —</span>
          <span className="text-[10px]" style={{ color: '#52525B' }}>♡ —</span>
        </div>
      </div>
      <div className="flex items-center gap-[5px] text-[11px] font-medium">
        <div className="w-4 h-4 rounded-[3px] flex items-center justify-center text-[9px] font-bold text-white" style={{ background: '#E1306C' }}>
          IG
        </div>
        <span style={{ color: '#A1A1AA' }}>{isDone ? 'Posted' : 'Pending'}</span>
      </div>
    </div>
  )
}

export type { VideoThumb }
