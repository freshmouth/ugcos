'use client'

import { useState } from 'react'

interface Props {
  projectId: string
  lastAnalyzedAt: string | null
}

export function InsightsAnalyzeButton({ projectId, lastAnalyzedAt }: Props) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function run() {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch('/api/insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, days_back: 90 }),
      })
      const json = await res.json()
      if (json.cached) { setMsg('Already analyzed today'); setLoading(false); return }
      if (!res.ok) { setMsg(`Error: ${json.error}`); setLoading(false); return }
      setMsg('Analysis complete!')
      setTimeout(() => window.location.reload(), 800)
    } catch (e) {
      setMsg(String(e))
      setLoading(false)
    }
  }

  const lastLabel = lastAnalyzedAt
    ? new Date(lastAnalyzedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex items-center gap-3 mt-3 flex-wrap">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-[5px] rounded-[8px] px-3 py-[6px] text-[11px] font-semibold disabled:opacity-50 transition-opacity"
        style={{
          background: 'rgba(124,58,237,0.2)',
          border: '1px solid rgba(124,58,237,0.3)',
          color: '#9D6BF5',
        }}
      >
        {loading ? '⟳ Analyzing...' : '✨ Run Analysis'}
      </button>
      {lastLabel && !msg && (
        <span className="text-[10px]" style={{ color: '#52525B' }}>Last: {lastLabel}</span>
      )}
      {msg && (
        <span className="text-[10px]" style={{ color: msg.startsWith('Error') ? '#EF4444' : '#22C55E' }}>
          {msg}
        </span>
      )}
    </div>
  )
}
