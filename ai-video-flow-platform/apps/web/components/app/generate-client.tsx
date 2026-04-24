'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LowCreditsModal } from '@/components/app/low-credits-modal'

type ProductImage = { id: string; url: string }
type Project = {
  id: string
  name: string
  content_types: string[]
  product_images?: ProductImage[]
}

interface Props {
  project: Project | null
  credits: number
}

export function GenerateClient({ project, credits }: Props) {
  const router = useRouter()
  const [contentType, setContentType] = useState(project?.content_types?.[0] ?? 'informative')
  const [imageId, setImageId] = useState<string>('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [showLowCredits, setShowLowCredits] = useState(false)

  async function handleGenerate() {
    if (credits < 30) {
      setShowLowCredits(true)
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

  if (!project) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-white">No project found. Complete onboarding first.</p>
        <Link href="/onboarding" className="rounded-lg px-6 py-3 font-semibold text-white" style={{ background: '#7C3AED' }}>
          Start Onboarding
        </Link>
      </div>
    )
  }

  const productImages = project.product_images ?? []

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold text-white">Generate a Video</h1>
      <p className="mb-6 text-sm" style={{ color: '#9CA3AF' }}>Creates a 15-second video and posts to your social accounts</p>

      {/* Credit display */}
      <div className="mb-6 rounded-xl border p-4" style={{ background: '#111111', borderColor: '#1F2937' }}>
        {credits >= 30 ? (
          <p className="text-sm text-white">🪙 {credits} credits remaining · This video costs 30 credits</p>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>⚠️ Not enough credits ({credits} / 30 needed)</p>
            <Link href="/billing" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: '#7C3AED' }}>
              Add Credits
            </Link>
          </div>
        )}
      </div>

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
                {ct}
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
          disabled={loading || credits < 30}
          className="h-14 w-full rounded-xl text-lg font-bold text-white disabled:opacity-60"
          style={{ background: '#7C3AED' }}
        >
          {loading ? 'Starting...' : '▶ Generate Video — 30 credits'}
        </button>
      </div>

      {showLowCredits && <LowCreditsModal onClose={() => setShowLowCredits(false)} />}
    </div>
  )
}
