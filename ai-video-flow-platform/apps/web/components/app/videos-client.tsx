'use client'

import Link from 'next/link'
import type { MetricEntry } from '@/app/(app)/videos/page'

type VideoRow = {
  id: string
  status: string
  content_type: string | null
  script_prompt: string | null
  captioned_url: string | null
  cloudinary_url: string | null
  fal_image_url: string | null
  created_at: string
  updated_at: string | null
  metricool_post_id: string | null
  hook_text: string | null
}

interface Props {
  videos: VideoRow[]
  instagramConnected: boolean
  facebookConnected: boolean
  metricsMap: Record<string, MetricEntry>
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toString()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PlatformBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="text-[9px] font-bold px-[5px] py-[2px] rounded-[3px] text-white"
      style={{ background: color }}
    >
      {label}
    </span>
  )
}

export function VideosClient({ videos, instagramConnected, facebookConnected, metricsMap }: Props) {
  if (videos.length === 0) {
    return (
      <div
        className="rounded-[16px] py-20 flex flex-col items-center justify-center"
        style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span className="text-[40px] mb-4">🎬</span>
        <p className="text-[16px] font-bold text-white mb-2">No videos posted yet</p>
        <p className="text-[13px] mb-6" style={{ color: '#52525B' }}>
          Generate your first video to auto-post it to Instagram &amp; Facebook.
        </p>
        <Link
          href="/generate"
          className="inline-flex items-center gap-2 px-5 py-[10px] rounded-[10px] text-[13px] font-semibold text-white"
          style={{ background: '#7C3AED' }}
        >
          Generate Video →
        </Link>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .posted-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }
        @media (max-width: 1200px) {
          .posted-grid { grid-template-columns: repeat(4, 1fr); }
        }
        @media (max-width: 900px) {
          .posted-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 600px) {
          .posted-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
      <div className="posted-grid">
        {videos.map(video => {
          const metrics = video.metricool_post_id ? metricsMap[video.metricool_post_id] : undefined
          const isViral = (metrics?.views ?? 0) >= 50000
          const thumbnail = metrics?.thumbnail ?? video.fal_image_url ?? video.captioned_url ?? video.cloudinary_url ?? null
          const hookText = video.script_prompt?.slice(0, 40) ?? video.hook_text?.slice(0, 40) ?? null
          const postLink = metrics?.postLink ?? null

          return (
            <div key={video.id} className="flex flex-col">
              {/* Thumbnail */}
              <div
                className="relative rounded-[12px] overflow-hidden flex-shrink-0"
                style={{ aspectRatio: '9/16', background: '#1A1A1F' }}
              >
                {thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnail}
                    alt={hookText ?? 'Posted video'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg,#1A1A2E,#16213E)' }}
                  >
                    <svg viewBox="0 0 20 20" fill="#3F3F46" width="32" height="32">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* VIRAL badge */}
                {isViral && (
                  <div className="absolute top-2 left-2">
                    <span
                      className="text-[9px] font-bold px-[6px] py-[3px] rounded-[4px]"
                      style={{ background: 'rgba(251,191,36,0.9)', color: '#000' }}
                    >
                      🔥 VIRAL
                    </span>
                  </div>
                )}

                {/* Platform badges top-right */}
                <div className="absolute top-2 right-2 flex flex-col gap-1">
                  {instagramConnected && <PlatformBadge label="IG" color="#E1306C" />}
                  {facebookConnected && <PlatformBadge label="FB" color="#1877F2" />}
                </div>
              </div>

              {/* Card body */}
              <div className="mt-[8px] flex flex-col gap-[4px]">
                {/* Hook text */}
                {hookText && (
                  <p
                    className="text-[11px] font-semibold leading-[1.4]"
                    style={{ color: '#E4E4E7' }}
                  >
                    &ldquo;{hookText}{(video.script_prompt?.length ?? 0) > 40 ? '…' : ''}&rdquo;
                  </p>
                )}

                {/* Metrics */}
                {metrics ? (
                  <div className="flex items-center gap-[6px] text-[10px]" style={{ color: isViral ? '#FBBF24' : '#71717A' }}>
                    <span>👁 {formatNum(metrics.views)}</span>
                    <span style={{ color: '#3F3F46' }}>·</span>
                    <span style={{ color: '#71717A' }}>♡ {formatNum(metrics.likes)}</span>
                    <span style={{ color: '#3F3F46' }}>·</span>
                    <span style={{ color: '#71717A' }}>{metrics.engagement.toFixed(1)}%</span>
                  </div>
                ) : (
                  <div className="text-[10px]" style={{ color: '#3F3F46' }}>No metrics yet</div>
                )}

                {/* Date */}
                <div className="text-[10px]" style={{ color: '#52525B' }}>
                  {formatDate(video.created_at)}
                </div>

                {/* View Post button */}
                {postLink ? (
                  <a
                    href={postLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-[2px] inline-flex items-center gap-[4px] text-[10px] font-semibold rounded-[6px] px-[8px] py-[4px]"
                    style={{
                      background: 'rgba(124,58,237,0.12)',
                      border: '1px solid rgba(124,58,237,0.25)',
                      color: '#9D6BF5',
                      width: 'fit-content',
                    }}
                  >
                    View Post
                    <svg viewBox="0 0 12 12" fill="currentColor" width="9" height="9">
                      <path d="M9 1H11V3M11 1L6 6M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                  </a>
                ) : (
                  <div
                    className="mt-[2px] inline-flex items-center text-[10px] font-medium rounded-[6px] px-[8px] py-[4px]"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      color: '#52525B',
                      width: 'fit-content',
                    }}
                  >
                    Posted
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
