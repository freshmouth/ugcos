'use client'

type Video = {
  id: string
  status: string
  content_type: string | null
  script_prompt: string | null
  cloudinary_url: string | null
  captioned_url: string | null
  created_at: string
}

export function VideoPreviewModal({ video, onClose }: { video: Video; onClose: () => void }) {
  const videoUrl = video.captioned_url || video.cloudinary_url

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: '#111111' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-white">Video Preview</h3>
          <button onClick={onClose} className="text-xl" style={{ color: '#9CA3AF' }}>×</button>
        </div>
        {videoUrl ? (
          <video src={videoUrl} controls autoPlay muted className="mb-4 w-full rounded-xl" style={{ aspectRatio: '9/16', maxHeight: '400px', objectFit: 'cover' }} />
        ) : (
          <div className="mb-4 flex items-center justify-center rounded-xl text-4xl" style={{ background: '#1F2937', aspectRatio: '9/16', maxHeight: '400px' }}>🎬</div>
        )}
        {video.script_prompt && (
          <p className="mb-3 rounded-lg p-3 text-sm" style={{ background: '#1A1A1A', color: '#9CA3AF' }}>
            {video.script_prompt}
          </p>
        )}
        <div className="mb-4 flex gap-2 text-xs" style={{ color: '#6B7280' }}>
          <span>{new Date(video.created_at).toLocaleDateString()}</span>
          {video.content_type && <span>· {video.content_type}</span>}
          <span>· {video.status}</span>
        </div>
        {videoUrl && (
          <a href={videoUrl} download className="block w-full rounded-lg py-2.5 text-center text-sm font-semibold text-white" style={{ background: '#374151' }}>
            Download
          </a>
        )}
      </div>
    </div>
  )
}
