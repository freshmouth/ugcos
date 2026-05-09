'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { VideoPreviewModal } from '@/components/app/video-preview-modal'

type Video = {
  id: string
  status: string
  content_type: string | null
  script_prompt: string | null
  cloudinary_url: string | null
  captioned_url: string | null
  created_at: string
  updated_at: string
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending:           { bg: '#1F2937', text: '#9CA3AF', label: 'Pending' },
  analyzing:         { bg: '#78350F', text: '#FCD34D', label: '1/7 Analyzing...' },
  scripting:         { bg: '#78350F', text: '#FCD34D', label: '2/7 Scripting...' },
  generating_images: { bg: '#78350F', text: '#FCD34D', label: '3/7 Generating Images...' },
  generating_video:  { bg: '#78350F', text: '#FCD34D', label: '4/7 Generating Video...' },
  assembling:        { bg: '#1E3A5F', text: '#60A5FA', label: '5/7 Assembling...' },
  captioning:        { bg: '#1E3A5F', text: '#60A5FA', label: '6/7 Captioning...' },
  posting:           { bg: '#1E3A5F', text: '#60A5FA', label: '7/7 Posting...' },
  generating:        { bg: '#78350F', text: '#FCD34D', label: 'Generating...' },
  processing:        { bg: '#78350F', text: '#FCD34D', label: 'Processing...' },
  uploading:         { bg: '#1E3A5F', text: '#60A5FA', label: 'Uploading' },
  done:              { bg: '#14532D', text: '#4ADE80', label: 'Done ✓' },
  failed:            { bg: '#7F1D1D', text: '#F87171', label: 'Failed' },
}

interface Props {
  userId: string
  videosRemaining: number
  initialVideos: Video[]
  project: { id: string; name: string; instagram_connected: boolean; facebook_connected: boolean } | null
  showWelcome: boolean
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function DashboardClient({ userId, videosRemaining, initialVideos, project, showWelcome }: Props) {
  const router = useRouter()
  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [toast, setToast] = useState('')
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null)
  const didWelcome = useRef(false)

  useEffect(() => {
    if (showWelcome && !didWelcome.current) {
      didWelcome.current = true
      setToast("Welcome! Your subscription is active — start generating videos.")
      router.replace('/dashboard')
      setTimeout(() => setToast(''), 5000)
    }
  }, [showWelcome, router])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('dashboard-videos')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'videos', filter: `user_id=eq.${userId}` },
        (payload) => {
          setVideos(prev => prev.map(v => v.id === payload.new.id ? { ...v, ...payload.new } : v))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const lastPosted = videos.find(v => v.status === 'done')
  const socialStatus = project
    ? `${project.instagram_connected ? 'IG ✓' : 'IG ✗'}  ${project.facebook_connected ? 'FB ✓' : 'FB ✗'}`
    : '—'

  return (
    <div>
      {toast && (
        <div className="mb-4 rounded-xl p-4 text-sm font-medium text-white" style={{ background: '#7C3AED' }}>
          {toast}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Videos Remaining', value: videosRemaining === Infinity ? 'Unlimited' : `${videosRemaining} left`, sub: <Link href="/billing" className="text-violet-400 hover:underline text-xs">Upgrade Plan</Link> },
          { label: 'Total Videos', value: videos.length.toString() },
          { label: 'Last Posted', value: lastPosted ? formatDate(lastPosted.created_at) : 'Never' },
          { label: 'Social Status', value: socialStatus },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border p-5" style={{ background: '#111111', borderColor: '#1F2937' }}>
            <div className="mb-1 text-xs" style={{ color: '#6B7280' }}>{s.label}</div>
            <div className="font-bold text-white">{s.value}</div>
            {s.sub && <div className="mt-1">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mb-8 text-center">
        {videosRemaining > 0 ? (
          <>
            <Link href="/generate" className="inline-block rounded-xl px-8 py-4 text-lg font-bold text-white" style={{ background: '#7C3AED' }}>
              ▶ Generate New Video
            </Link>
            <p className="mt-2 text-sm" style={{ color: '#6B7280' }}>
              {videosRemaining === Infinity ? 'Unlimited videos on your plan' : `${videosRemaining} video${videosRemaining === 1 ? '' : 's'} remaining this cycle`}
            </p>
          </>
        ) : (
          <>
            <Link href="/billing" className="inline-block rounded-xl px-8 py-4 text-lg font-bold text-white" style={{ background: '#DC2626' }}>
              Upgrade to Generate
            </Link>
            <p className="mt-2 text-sm" style={{ color: '#DC2626' }}>You&apos;ve used all videos in your current billing cycle</p>
          </>
        )}
      </div>

      {/* Video history */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-white">Your Videos</h2>
        {videos.length === 0 ? (
          <div className="rounded-xl border py-16 text-center" style={{ background: '#111111', borderColor: '#1F2937' }}>
            <div className="mb-3 text-4xl">🎬</div>
            <p className="font-semibold text-white">No videos yet</p>
            <p className="mb-4 text-sm" style={{ color: '#9CA3AF' }}>Generate your first video to get started</p>
            <Link href="/generate" className="inline-block rounded-lg px-6 py-2.5 font-semibold text-white" style={{ background: '#7C3AED' }}>
              Generate First Video
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border" style={{ background: '#111111', borderColor: '#1F2937' }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #1F2937' }}>
                  {['Thumbnail', 'Date', 'Status', 'Type', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6B7280' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {videos.map(v => {
                  const s = STATUS_STYLES[v.status] ?? STATUS_STYLES['pending']!
                  const thumbUrl = v.captioned_url || v.cloudinary_url
                  return (
                    <tr key={v.id} className="cursor-pointer hover:bg-white/5" style={{ borderBottom: '1px solid #1F2937' }} onClick={() => setPreviewVideo(v)}>
                      <td className="px-4 py-3">
                        {thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbUrl} alt="" className="h-16 w-10 rounded object-cover" />
                        ) : (
                          <div className="flex h-16 w-10 items-center justify-center rounded text-2xl" style={{ background: '#1F2937' }}>🎬</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{formatDate(v.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: s.bg, color: s.text }}>
                          {s.label}
                          {['generating', 'processing'].includes(v.status) && (
                            <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: s.text }} />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {v.content_type && (
                          <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: '#1F2937', color: '#9CA3AF' }}>
                            {v.content_type}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); setPreviewVideo(v) }} className="rounded px-3 py-1 text-xs font-medium text-white" style={{ background: '#374151' }}>
                          Preview
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {previewVideo && (
        <VideoPreviewModal video={previewVideo} onClose={() => setPreviewVideo(null)} />
      )}
    </div>
  )
}
