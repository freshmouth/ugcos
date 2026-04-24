'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const TABS = ['Profile', 'My Product', 'Social Accounts', 'Autopilot'] as const
type Tab = (typeof TABS)[number]

const CONTENT_TYPES = [
  { id: 'informative', emoji: '🎓', label: 'Informative' },
  { id: 'viral', emoji: '🔥', label: 'Viral' },
  { id: 'shocking', emoji: '😱', label: 'Shocking' },
  { id: 'emotional', emoji: '💛', label: 'Emotional' },
  { id: 'transformation', emoji: '💪', label: 'Transformation' },
  { id: 'humor', emoji: '🤣', label: 'Humor' },
  { id: 'sales', emoji: '🛒', label: 'Sales & Promo' },
]

type Profile = {
  id: string; email: string; full_name: string | null; avatar_url: string | null
}
type Project = {
  id: string; name: string; product_description: string | null; target_audience: string | null
  product_category: string | null; content_types: string[]; posting_frequency: string
  posting_time: string; autopilot: boolean; instagram_connected: boolean; facebook_connected: boolean
  metricool_brand_id: string | null; script_prompts: string[]
}
type ProductImage = { id: string; url: string; public_id: string }

interface Props {
  profile: Profile | null
  project: Project | null
  productImages: ProductImage[]
}

export function SettingsClient({ profile: initialProfile, project: initialProject, productImages: initialImages }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('Profile')
  const [toast, setToast] = useState('')

  // Profile state
  const [fullName, setFullName] = useState(initialProfile?.full_name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Product state
  const [projectName, setProjectName] = useState(initialProject?.name ?? '')
  const [description, setDescription] = useState(initialProject?.product_description ?? '')
  const [audience, setAudience] = useState(initialProject?.target_audience ?? '')
  const [contentTypes, setContentTypes] = useState<string[]>(initialProject?.content_types ?? [])
  const [scriptPrompts, setScriptPrompts] = useState<string[]>(initialProject?.script_prompts ?? [''])
  const [savingProduct, setSavingProduct] = useState(false)
  const [images, setImages] = useState<ProductImage[]>(initialImages)

  // Social state
  const [igConnected, setIgConnected] = useState(initialProject?.instagram_connected ?? false)
  const [fbConnected, setFbConnected] = useState(initialProject?.facebook_connected ?? false)

  // Autopilot state
  const [autopilot, setAutopilot] = useState(initialProject?.autopilot ?? false)
  const [postingTime, setPostingTime] = useState(initialProject?.posting_time ?? 'morning')
  const [savingAutopilot, setSavingAutopilot] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function saveProfile() {
    if (!initialProfile) return
    setSavingProfile(true)
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', initialProfile.id)
    setSavingProfile(false)
    showToast('Profile updated')
  }

  async function saveProduct() {
    if (!initialProject) return
    setSavingProduct(true)
    await supabase.from('projects').update({
      name: projectName,
      product_description: description,
      target_audience: audience,
      content_types: contentTypes,
      script_prompts: scriptPrompts.filter(p => p.trim()),
    }).eq('id', initialProject.id)
    setSavingProduct(false)
    showToast('Product settings saved')
  }

  async function deleteImage(img: ProductImage) {
    await fetch('/api/upload/product-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: img.public_id, image_id: img.id }),
    })
    setImages(prev => prev.filter(i => i.id !== img.id))
  }

  async function saveSocial() {
    if (!initialProject) return
    await supabase.from('projects').update({
      instagram_connected: igConnected,
      facebook_connected: fbConnected,
    }).eq('id', initialProject.id)
    showToast('Social accounts saved')
  }

  async function saveAutopilot() {
    if (!initialProject) return
    setSavingAutopilot(true)
    await supabase.from('projects').update({
      autopilot,
      posting_time: postingTime,
      content_types: contentTypes,
    }).eq('id', initialProject.id)
    setSavingAutopilot(false)
    showToast('Autopilot settings saved')
  }

  const inputStyle = { background: '#1A1A1A', borderColor: '#374151', color: '#fff' }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">Settings</h1>

      {toast && (
        <div className="mb-4 rounded-xl p-3 text-sm font-medium text-white" style={{ background: '#16A34A' }}>
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl p-1" style={{ background: '#111111' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 rounded-lg py-2 text-sm font-medium transition-colors"
            style={{ background: tab === t ? '#7C3AED' : 'transparent', color: tab === t ? '#fff' : '#9CA3AF' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === 'Profile' && (
        <div className="rounded-xl border p-6 space-y-4" style={{ background: '#111111', borderColor: '#1F2937' }}>
          <div>
            <label className="mb-1 block text-sm text-white">Full name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} className="h-11 w-full rounded-lg border px-4 outline-none focus:border-violet-500" style={inputStyle} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white">Email</label>
            <input value={initialProfile?.email ?? ''} readOnly className="h-11 w-full rounded-lg border px-4 opacity-60" style={inputStyle} />
            <p className="mt-1 text-xs" style={{ color: '#6B7280' }}>Managed by your login</p>
          </div>
          <button onClick={saveProfile} disabled={savingProfile} className="rounded-lg px-5 py-2.5 font-semibold text-white disabled:opacity-60" style={{ background: '#7C3AED' }}>
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}

      {/* My Product */}
      {tab === 'My Product' && (
        <div className="rounded-xl border p-6 space-y-4" style={{ background: '#111111', borderColor: '#1F2937' }}>
          <div>
            <label className="mb-1 block text-sm text-white">Brand / product name</label>
            <input value={projectName} onChange={e => setProjectName(e.target.value)} className="h-11 w-full rounded-lg border px-4 outline-none focus:border-violet-500" style={inputStyle} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white">Product description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border px-4 py-3 outline-none focus:border-violet-500" style={inputStyle} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white">Target audience</label>
            <textarea value={audience} onChange={e => setAudience(e.target.value)} rows={2} className="w-full rounded-lg border px-4 py-3 outline-none focus:border-violet-500" style={inputStyle} />
          </div>

          {/* Product images */}
          <div>
            <label className="mb-2 block text-sm text-white">Product images</label>
            <div className="flex flex-wrap gap-2">
              {images.map(img => (
                <div key={img.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-20 w-14 rounded-lg object-cover" />
                  <button onClick={() => deleteImage(img)} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs text-white" style={{ background: '#DC2626' }}>×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Content types */}
          <div>
            <label className="mb-2 block text-sm text-white">Content types</label>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_TYPES.map(ct => {
                const selected = contentTypes.includes(ct.id)
                return (
                  <button key={ct.id} onClick={() => setContentTypes(prev => selected ? prev.filter(x => x !== ct.id) : [...prev, ct.id])}
                    className="rounded-xl border px-3 py-2 text-left text-sm transition-colors"
                    style={{ borderColor: selected ? '#7C3AED' : '#374151', background: selected ? 'rgba(124,58,237,0.1)' : 'transparent', color: '#fff' }}>
                    {ct.emoji} {ct.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Script prompts */}
          <div>
            <label className="mb-2 block text-sm text-white">Script Prompt Library</label>
            <div className="space-y-2">
              {scriptPrompts.map((prompt, i) => (
                <div key={i} className="flex gap-2">
                  <textarea value={prompt} onChange={e => setScriptPrompts(prev => prev.map((p, j) => j === i ? e.target.value : p))}
                    rows={2} className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-violet-500" style={inputStyle} />
                  {scriptPrompts.length > 1 && (
                    <button onClick={() => setScriptPrompts(prev => prev.filter((_, j) => j !== i))} className="px-2 text-sm" style={{ color: '#DC2626' }}>×</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setScriptPrompts(prev => [...prev, ''])} className="mt-2 text-sm" style={{ color: '#7C3AED' }}>+ Add prompt</button>
          </div>

          <button onClick={saveProduct} disabled={savingProduct} className="rounded-lg px-5 py-2.5 font-semibold text-white disabled:opacity-60" style={{ background: '#7C3AED' }}>
            {savingProduct ? 'Saving...' : 'Save Product Settings'}
          </button>
        </div>
      )}

      {/* Social Accounts */}
      {tab === 'Social Accounts' && (
        <div className="rounded-xl border p-6 space-y-4" style={{ background: '#111111', borderColor: '#1F2937' }}>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'ig', emoji: '📸', name: 'Instagram', connected: igConnected, setConnected: setIgConnected },
              { key: 'fb', emoji: '👥', name: 'Facebook', connected: fbConnected, setConnected: setFbConnected },
            ].map(({ key, emoji, name, connected, setConnected }) => (
              <div key={key} className="rounded-xl border p-5 text-center" style={{ borderColor: '#374151' }}>
                <div className="mb-1 text-2xl">{emoji}</div>
                <div className="mb-1 font-semibold text-white">{name}</div>
                <div className="mb-3 text-sm" style={{ color: connected ? '#16A34A' : '#9CA3AF' }}>
                  {connected ? '✓ Connected' : 'Not connected'}
                </div>
                <button onClick={() => setConnected(!connected)}
                  className="w-full rounded-lg py-2 text-sm font-semibold text-white"
                  style={{ background: connected ? '#374151' : '#7C3AED' }}>
                  {connected ? 'Disconnect' : `Connect ${name}`}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            Connections are managed via Metricool. Disconnecting here removes posting permissions but doesn&apos;t disconnect your Metricool account.
          </p>
          <button onClick={saveSocial} className="rounded-lg px-5 py-2.5 font-semibold text-white" style={{ background: '#7C3AED' }}>
            Save Social Accounts
          </button>
        </div>
      )}

      {/* Autopilot */}
      {tab === 'Autopilot' && (
        <div className="rounded-xl border p-6 space-y-6" style={{ background: '#111111', borderColor: '#1F2937' }}>
          <div>
            <h3 className="mb-1 font-semibold text-white">Autopilot Settings</h3>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>When enabled, a video is generated and posted automatically every day</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-white">Autopilot</span>
            <button onClick={() => setAutopilot(!autopilot)}
              className="relative h-7 w-12 rounded-full transition-colors"
              style={{ background: autopilot ? '#16A34A' : '#374151' }}>
              <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                style={{ left: '2px', transform: autopilot ? 'translateX(20px)' : 'none' }} />
            </button>
          </div>

          {autopilot && (
            <>
              <div>
                <label className="mb-2 block text-sm text-white">When should we post?</label>
                <select value={postingTime} onChange={e => setPostingTime(e.target.value)}
                  className="h-11 w-full rounded-lg border px-4 outline-none focus:border-violet-500" style={inputStyle}>
                  <option value="morning">🌅 Morning (8–10 AM)</option>
                  <option value="afternoon">☀️ Afternoon (12–2 PM)</option>
                  <option value="evening">🌆 Evening (6–8 PM)</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-white">Content type rotation</label>
                <div className="space-y-1">
                  {contentTypes.map((ct, i) => (
                    <div key={ct} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: '#374151' }}>
                      <span className="text-sm" style={{ color: '#6B7280' }}>{i + 1}.</span>
                      <span className="flex-1 text-sm text-white">{ct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <button onClick={saveAutopilot} disabled={savingAutopilot} className="rounded-lg px-5 py-2.5 font-semibold text-white disabled:opacity-60" style={{ background: '#7C3AED' }}>
            {savingAutopilot ? 'Saving...' : 'Save Autopilot Settings'}
          </button>
        </div>
      )}
    </div>
  )
}
