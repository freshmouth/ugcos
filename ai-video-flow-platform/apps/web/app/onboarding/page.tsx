'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Stepper } from '@/components/app/onboarding/stepper'

const CATEGORIES = [
  'Food & Beverage',
  'Health & Wellness',
  'Beauty',
  'Fashion',
  'Tech',
  'Home & Living',
  'Services',
  'Other',
]

const CONTENT_TYPES = [
  { id: 'informative', emoji: '🎓', label: 'Informative', desc: 'Educate your audience with facts and tips' },
  { id: 'viral', emoji: '🔥', label: 'Viral', desc: 'Bold takes that spark debate and shares' },
  { id: 'shocking', emoji: '😱', label: 'Shocking', desc: 'Surprising facts that stop the scroll' },
  { id: 'emotional', emoji: '💛', label: 'Emotional', desc: 'Stories that connect and inspire' },
  { id: 'transformation', emoji: '💪', label: 'Transformation', desc: 'Before/after, results-driven content' },
  { id: 'humor', emoji: '🤣', label: 'Humor', desc: 'Lighthearted content that makes people laugh' },
  { id: 'sales', emoji: '🛒', label: 'Sales & Promo', desc: 'Direct offer, discount, urgency-driven' },
]

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const step = Number(searchParams.get('step') || '1')
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [projectId, setProjectId] = useState<string>('')

  // Step 1
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [audience, setAudience] = useState('')
  const [category, setCategory] = useState('')

  // Step 2
  const [images, setImages] = useState<{ url: string; public_id: string }[]>([])
  const [uploading, setUploading] = useState(false)

  // Step 3
  const [contentTypes, setContentTypes] = useState<string[]>([])
  const [frequency, setFrequency] = useState<'daily' | 'manual'>('manual')

  // Step 4
  const [igConnected, setIgConnected] = useState(false)
  const [fbConnected, setFbConnected] = useState(false)

  useEffect(() => {
    const pid = sessionStorage.getItem('onboarding_project_id')
    if (pid) setProjectId(pid)

    const brandId = new URLSearchParams(window.location.search).get('brand_id')
    if (brandId && projectId) {
      supabase.from('projects').update({ metricool_brand_id: brandId }).eq('id', projectId)
    }
  }, [])

  function goToStep(n: number) {
    router.push(`/onboarding?step=${n}`)
  }

  async function handleStep1() {
    if (!name) return setError('Brand name is required')
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')
    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name, product_description: description, target_audience: audience, product_category: category })
      .select()
      .single()
    setLoading(false)
    if (error) return setError(error.message)
    sessionStorage.setItem('onboarding_project_id', data.id)
    setProjectId(data.id)
    goToStep(2)
  }

  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    if (!projectId) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('project_id', projectId)
      const res = await fetch('/api/upload/product-image', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) setImages(prev => [...prev, { url: data.url, public_id: data.public_id }])
    }
    setUploading(false)
  }, [projectId])

  async function handleStep3() {
    if (contentTypes.length === 0) return setError('Select at least one content type')
    setLoading(true)
    await supabase.from('projects').update({
      content_types: contentTypes,
      posting_frequency: frequency,
      autopilot: frequency === 'daily',
    }).eq('id', projectId)
    setLoading(false)
    goToStep(4)
  }

  async function handleFinish() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ onboarding_done: true }).eq('id', user.id)
    setLoading(false)
    router.push('/dashboard?welcome=true')
  }

  const inputStyle = {
    background: '#1A1A1A',
    borderColor: '#374151',
    color: '#fff',
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: '#0A0A0A' }}>
      <div className="mx-auto max-w-xl">
        <div className="mb-4 text-center text-xl font-bold text-white">▶ AI Video Flow</div>
        <Stepper currentStep={step} />

        {/* Step 1 */}
        {step === 1 && (
          <div className="rounded-xl p-8" style={{ background: '#111111' }}>
            <h2 className="mb-1 text-2xl font-bold text-white">Your Product</h2>
            <p className="mb-6 text-sm" style={{ color: '#9CA3AF' }}>Tell us about what you&apos;re selling</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-white">Brand or product name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="h-12 w-full rounded-lg border px-4 outline-none focus:border-violet-500" style={inputStyle} placeholder="e.g. Acme Coffee Roasters" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-white">What does your product do?</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={300} rows={3} className="w-full rounded-lg border px-4 py-3 outline-none focus:border-violet-500" style={inputStyle} placeholder="Describe your product..." />
                <div className="mt-1 text-right text-xs" style={{ color: '#6B7280' }}>{description.length}/300</div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-white">Who is your target audience?</label>
                <textarea value={audience} onChange={e => setAudience(e.target.value)} maxLength={200} rows={2} className="w-full rounded-lg border px-4 py-3 outline-none focus:border-violet-500" style={inputStyle} placeholder="e.g. Health-conscious millennials who love specialty coffee" />
                <div className="mt-1 text-right text-xs" style={{ color: '#6B7280' }}>{audience.length}/200</div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-white">Product category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="h-12 w-full rounded-lg border px-4 outline-none focus:border-violet-500" style={inputStyle}>
                  <option value="">Select a category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {error && <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>}
              <button onClick={handleStep1} disabled={loading} className="h-12 w-full rounded-lg font-semibold text-white disabled:opacity-60" style={{ background: '#7C3AED' }}>
                {loading ? 'Saving...' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="rounded-xl p-8" style={{ background: '#111111' }}>
            <h2 className="mb-1 text-2xl font-bold text-white">Upload Product Photos</h2>
            <p className="mb-6 text-sm" style={{ color: '#9CA3AF' }}>Upload at least 1 photo of your product</p>
            <div
              className="mb-4 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-violet-500"
              style={{ borderColor: '#374151' }}
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files) }}
            >
              <div className="mb-2 text-3xl">📸</div>
              <p className="text-sm text-white">Drag & drop photos here, or click to browse</p>
              <p className="mt-1 text-xs" style={{ color: '#6B7280' }}>JPEG, PNG, WebP · Max 10 images</p>
              <input id="file-input" type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => e.target.files && handleFileUpload(e.target.files)} />
            </div>
            {uploading && <p className="mb-2 text-sm" style={{ color: '#9CA3AF' }}>Uploading...</p>}
            {images.length > 0 && (
              <div className="mb-4 grid grid-cols-4 gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-20 w-full rounded-lg object-cover" />
                    <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white" style={{ background: '#DC2626' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => goToStep(1)} className="h-12 flex-1 rounded-lg border font-semibold text-white" style={{ borderColor: '#374151' }}>← Back</button>
              <button onClick={() => goToStep(3)} disabled={images.length === 0} className="h-12 flex-1 rounded-lg font-semibold text-white disabled:opacity-40" style={{ background: '#7C3AED' }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="rounded-xl p-8" style={{ background: '#111111' }}>
            <h2 className="mb-1 text-2xl font-bold text-white">Content Style</h2>
            <p className="mb-4 text-sm" style={{ color: '#9CA3AF' }}>Choose how your videos will feel</p>
            <div className="mb-6 grid grid-cols-2 gap-3">
              {CONTENT_TYPES.map(ct => {
                const selected = contentTypes.includes(ct.id)
                return (
                  <button key={ct.id} onClick={() => setContentTypes(prev => selected ? prev.filter(x => x !== ct.id) : [...prev, ct.id])}
                    className="rounded-xl border p-4 text-left transition-colors"
                    style={{ borderColor: selected ? '#7C3AED' : '#374151', background: selected ? 'rgba(124,58,237,0.1)' : 'transparent' }}>
                    <div className="text-xl">{ct.emoji}</div>
                    <div className="mt-1 font-semibold text-white">{ct.label}</div>
                    <div className="text-xs" style={{ color: '#9CA3AF' }}>{ct.desc}</div>
                  </button>
                )
              })}
            </div>
            <div className="mb-4">
              <p className="mb-3 font-semibold text-white">Posting frequency</p>
              <div className="grid grid-cols-2 gap-3">
                {(['daily', 'manual'] as const).map(f => (
                  <button key={f} onClick={() => setFrequency(f)}
                    className="rounded-xl border p-4 text-left transition-colors"
                    style={{ borderColor: frequency === f ? '#7C3AED' : '#374151', background: frequency === f ? 'rgba(124,58,237,0.1)' : 'transparent' }}>
                    <div className="text-xl">{f === 'daily' ? '🤖' : '🎮'}</div>
                    <div className="mt-1 font-semibold text-white">{f === 'daily' ? 'Daily Autopilot' : 'Manual Control'}</div>
                    <div className="text-xs" style={{ color: '#9CA3AF' }}>{f === 'daily' ? 'Generate and post automatically every day' : "I'll trigger each video myself"}</div>
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="mb-3 text-sm" style={{ color: '#DC2626' }}>{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => goToStep(2)} className="h-12 flex-1 rounded-lg border font-semibold text-white" style={{ borderColor: '#374151' }}>← Back</button>
              <button onClick={handleStep3} disabled={loading} className="h-12 flex-1 rounded-lg font-semibold text-white disabled:opacity-60" style={{ background: '#7C3AED' }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="rounded-xl p-8" style={{ background: '#111111' }}>
            <h2 className="mb-1 text-2xl font-bold text-white">Connect Social Accounts</h2>
            <p className="mb-6 text-sm" style={{ color: '#9CA3AF' }}>You can skip this and connect later in Settings</p>
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border p-6 text-center" style={{ borderColor: '#374151' }}>
                <div className="mb-2 text-3xl">📸</div>
                <div className="mb-1 font-semibold text-white">Instagram</div>
                <div className="mb-3 text-sm" style={{ color: igConnected ? '#16A34A' : '#9CA3AF' }}>
                  {igConnected ? '✓ Connected' : 'Not connected'}
                </div>
                <button onClick={() => setIgConnected(true)} className="w-full rounded-lg py-2 text-sm font-semibold text-white" style={{ background: igConnected ? '#16A34A' : '#7C3AED' }}>
                  {igConnected ? 'Connected ✓' : 'Connect Instagram'}
                </button>
              </div>
              <div className="rounded-xl border p-6 text-center" style={{ borderColor: '#374151' }}>
                <div className="mb-2 text-3xl">👥</div>
                <div className="mb-1 font-semibold text-white">Facebook</div>
                <div className="mb-3 text-sm" style={{ color: fbConnected ? '#16A34A' : '#9CA3AF' }}>
                  {fbConnected ? '✓ Connected' : 'Not connected'}
                </div>
                <button onClick={() => setFbConnected(true)} className="w-full rounded-lg py-2 text-sm font-semibold text-white" style={{ background: fbConnected ? '#16A34A' : '#1877F2' }}>
                  {fbConnected ? 'Connected ✓' : 'Connect Facebook'}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => goToStep(3)} className="h-12 flex-1 rounded-lg border font-semibold text-white" style={{ borderColor: '#374151' }}>← Back</button>
              <button onClick={handleFinish} disabled={loading} className="h-12 flex-1 rounded-lg font-semibold text-white disabled:opacity-60" style={{ background: '#7C3AED' }}>
                {loading ? 'Saving...' : 'Finish Setup ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ background: '#0A0A0A', minHeight: '100vh' }} />}>
      <OnboardingContent />
    </Suspense>
  )
}
