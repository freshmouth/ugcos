'use client'

import { useState } from 'react'

type VideoThumb = {
  id: string
  status: string
  content_type: string | null
  captioned_url: string | null
  cloudinary_url: string | null
  created_at: string
  hook_text?: string | null
}

const GRADIENT_CLASSES = [
  'linear-gradient(160deg,#c8a882 0%,#6b4a2a 100%)',
  'linear-gradient(160deg,#3a3a3a 0%,#1a1a1a 100%)',
  'linear-gradient(160deg,#8a7060 0%,#4a3020 100%)',
  'linear-gradient(160deg,#2a2a2a 0%,#4a4030 100%)',
  'linear-gradient(160deg,#3a3028 0%,#1a1510 100%)',
]

interface Props {
  video: VideoThumb
  index: number
  onClick?: (video: VideoThumb) => void
}

export function VideoThumbCard({ video, index, onClick }: Props) {
  const [hovered, setHovered] = useState(false)
  const thumbUrl = video.captioned_url || video.cloudinary_url
  const gradient = GRADIENT_CLASSES[index % GRADIENT_CLASSES.length]!
  const hookText = video.hook_text ?? video.content_type ?? 'Video'
  const isDone = video.status === 'done'

  return (
    <div
      className="cursor-pointer transition-transform duration-200"
      style={{ transform: hovered ? 'translateY(-3px)' : 'translateY(0)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick?.(video)}
    >
      {/* Thumbnail */}
      <div
        className="w-full rounded-[12px] overflow-hidden relative mb-2"
        style={{
          aspectRatio: '9/16',
          background: '#1A1A1F',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-end" style={{ background: gradient }}>
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0) 50%)' }}
            />
          </div>
        )}

        {/* Sparkle */}
        <div
          className="absolute top-2 left-2 text-[10px]"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          ✦
        </div>

        {/* Hook text */}
        <div
          className="absolute bottom-7 left-2 right-2 text-[12px] font-extrabold leading-tight"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
        >
          {hookText.length > 30 ? hookText.slice(0, 30) + '...' : hookText}
        </div>

        {/* Duration badge */}
        <div
          className="absolute bottom-[6px] right-[6px] text-[10px] font-semibold px-[6px] py-[2px] rounded-[4px]"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
        >
          0:15
        </div>

        {/* Status overlay for non-done videos */}
        {!isDone && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-[12px]"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <span
              className="text-[11px] font-semibold px-2 py-1 rounded-full"
              style={{ background: 'rgba(124,58,237,0.8)', color: '#fff' }}
            >
              {video.status}
            </span>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex gap-[6px] items-center">
          <span className="text-[10px]" style={{ color: '#52525B' }}>↑ —</span>
          <span className="text-[10px]" style={{ color: '#52525B' }}>♡ —</span>
        </div>
      </div>
      <div className="flex items-center gap-[5px] text-[11px] font-medium" style={{ color: '#A1A1AA' }}>
        <div
          className="w-4 h-4 rounded-[3px] flex items-center justify-center text-[9px] font-bold text-white"
          style={{ background: '#E1306C' }}
        >
          IG
        </div>
        <span style={{ color: '#A1A1AA' }}>{isDone ? 'Posted' : 'Pending'}</span>
      </div>
    </div>
  )
}

export type { VideoThumb }
