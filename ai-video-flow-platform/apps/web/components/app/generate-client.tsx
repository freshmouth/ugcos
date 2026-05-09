'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LowCreditsModal } from '@/components/app/low-credits-modal'

const CONTENT_TYPE_LABELS: Record<string, string> = {
  informative: '🎓 Informative',
  viral: '🔥 Viral',
  shocking: '😱 Shocking',
  emotional: '💛 Emotional',
  transformation: '💪 Transformation',
  humor: '🤣 Humor',
  sales: '🛒 Sales & Promo',
  scroll_stopper: '🛑 Scroll Stopper',
}

type ProductImage = { id: string; url: string }
type Project = {
  id: string
  name: string
  content_types: string[]
  product_images?: ProductImage[]
}

interface Props {
  projects: Project[]
  videosRemaining: number
}

export function GenerateClient({ projects, videosRemaining }: Props) {
  const router = useRouter()
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id ?? '')
  const [contentType, setContentType] = useState(projects[0]?.content_types?.[0] ?? 'informative')
  const [imageId, setImageId] = useState<string>('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [showQuotaModal, setShowQuotaModal] = useState(false)

  const project = projects.find(p => p.id === selectedProjectId) ?? projects[0] ?? null
  const hasQuota = videosRemaining === Infinity || videosRemaining > 0

  function handleProjectChange(id: string) {
    const p = projects.find(pr => pr.id === id)
    setSelectedProjectId(id)
    setContentType(p?.content_types?.[0] ?? 'informative')
    setImageId('')
  }

  async function handleGenerate() {
    if (!hasQuota) {
      setShowQuotaModal(true)
      return
    }
    if (!project) return
    setLoading(true)
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: project.id,
        content_type_override: contentType,
        custom_prompt: customPrompt || undefined,
        image_id: imageId || undefined,
      }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/dashboard')
    }
  }

  if (projects.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-white">No project found. Complete onboarding first.</p>
        <Link href="/onboarding" className="rounded-lg px-6 py-3 font-semibold text-white" style={{ background: '#7C3AED' }}>
          Start Onboarding
        </Link>
      </div>
    )
  }

  const productImages = project?.product_images ?? []

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold text-white">Generate a Video</h1>
      <p className="mb-6 text-sm" style={{ color: '#9CA3AF' }}>Creates a 15-second video and posts to your social accounts</p>

      {/* Brand selector — only shown when user has multiple projects */}
      {projects.length > 1 && (
        <div className="mb-5 rounded-xl border p-3" style={{ background: '#111111', borderColor: '#1F2937' }}>
          <label className="block text-[11px] font-semibold mb-2" style={{ color: '#52525B' }}>GENERATING FOR</label>
          <div className="flex flex-wrap gap-2">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => handleProjectChange(p.id)}
                className="rounded-[8px] px-3 py-[6px] text-[13px] font-semibold transition-colors"
                style={{
                  background: selectedProjectId === p.id ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${selectedProjectId === p.id ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: selectedProjectId === p.id ? '#C4B5FD' : '#A1A1AA',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quota display */}
      <div className="mb-6 rounded-xl border p-4" style={{ background: '#111111', borderColor: '#1F2937' }}>
        {hasQuota ? (
          <p className="text-sm text-white">
            ▶ {videosRemaining === Infinity ? 'Unlimited' : videosRemaining} video{videosRemaining !== 1 ? 's' : ''} remaining this cycle
          </p>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>⚠️ Monthly quota reached</p>
            <Link href="/billing" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: '#7C3AED' }}>
              Upgrade Plan
            </Link>
          </div>
        )}
      </div>

      {project && (
        <div className="space-y-6">
          {/* Content Type */}
          <div>
            <label className="mb-2 block text-sm font-medium text-white">Content Type</label>
            <div className="flex flex-wrap gap-2">
              {(project.content_types.length > 0 ? project.content_types : ['informative']).map(ct => (
                <button
                  key={ct}
                  onClick={() => setContentType(ct)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    background: contentType === ct ? '#7C3AED' : '#1F2937',
                    color: contentType === ct ? '#fff' : '#9CA3AF',
                  }}
                >
                  {CONTENT_TYPE_LABELS[ct] ?? ct}
                </button>
              ))}
            </div>
          </div>

          {/* Product Images */}
          {productImages.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-white">Product Image (optional)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setImageId('')}
                  className="rounded-lg border px-3 py-1.5 text-xs"
                  style={{ borderColor: !imageId ? '#7C3AED' : '#374151', color: !imageId ? '#fff' : '#9CA3AF', background: !imageId ? 'rgba(124,58,237,0.1)' : 'transparent' }}
                >
                  Auto
                </button>
                {productImages.map(img => (
                  <button
                    key={img.id}
                    onClick={() => setImageId(img.id)}
                    className="rounded-lg border overflow-hidden"
                    style={{ borderColor: imageId === img.id ? '#7C3AED' : '#374151' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-14 w-10 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Prompt */}
          <div>
            <label className="mb-2 block text-sm font-medium text-white">Custom Hook Prompt (optional)</label>
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              rows={3}
              className="w-full rounded-lg border px-4 py-3 text-sm outline-none focus:border-violet-500"
              style={{ background: '#1A1A1A', borderColor: '#374151', color: '#fff' }}
              placeholder="Leave empty to auto-generate from your content library"
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !hasQuota}
            className="h-14 w-full rounded-xl text-lg font-bold text-white disabled:opacity-60"
            style={{ background: '#7C3AED' }}
          >
            {loading ? 'Starting...' : '▶ Generate Video'}
          </button>
        </div>
      )}

      {showQuotaModal && <LowCreditsModal onClose={() => setShowQuotaModal(false)} />}
    </div>
  )
}
