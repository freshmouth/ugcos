'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PipelineProgress } from './pipeline-progress'
import type { StepStatus } from './pipeline-progress'

type VideoStatus =
  | 'pending' | 'generating_images' | 'scripting'
  | 'generating_video' | 'assembling' | 'captioning' | 'posting' | 'done' | 'failed'

type ActiveVideo = { id: string; status: VideoStatus; updated_at: string }

const STEPS = [
  { label: 'Creating avatar & scenes' },
  { label: 'Generating script' },
  { label: 'Editing video' },
  { label: 'Assembling footage' },
  { label: 'Adding captions' },
  { label: 'Auto posting' },
]

const STATUS_STEP: Record<string, number> = {
  pending: 0,
  generating_images: 0,
  scripting: 1,
  generating_video: 2,
  assembling: 3,
  captioning: 4,
  posting: 5,
}

function getStepStatus(stepIndex: number, currentStatus: string): StepStatus {
  const active = STATUS_STEP[currentStatus] ?? 0
  if (stepIndex < active) return 'done'
  if (stepIndex === active) return 'progress'
  return 'pending'
}

interface Props {
  userId: string
}

export function AgentStatusWidget({ userId }: Props) {
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null)

  const fetchActive = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('videos')
      .select('id, status, updated_at')
      .eq('user_id', userId)
      .neq('status', 'done')
      .neq('status', 'failed')
      .gte('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setActiveVideo(data as ActiveVideo | null)
  }, [userId])

  useEffect(() => {
    fetchActive()

    const supabase = createClient()
    const ch = supabase
      .channel('agent-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'videos', filter: `user_id=eq.${userId}` },
        () => { fetchActive() }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [userId, fetchActive])

  const isActive = activeVideo !== null

  return (
    <div
      className="rounded-[16px] p-6"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse-green{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      {!isActive ? (
        <div className="flex flex-col items-center justify-center py-4 gap-2">
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: '#1A1A1F',
            border: '2px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 36 }}>🤖</span>
          </div>
          <div className="text-[13px] font-bold mt-2">UGC.OS Agent</div>
          <div style={{ color: '#6B7280', fontSize: 12 }}>● Idle</div>
          <div style={{ color: '#52525B', fontSize: 12, marginTop: 8 }}>No active generation</div>
          <div style={{ color: '#52525B', fontSize: 11 }}>Trigger one from Generate</div>
        </div>
      ) : (
        <div className="flex gap-7 items-start">
          <div className="flex flex-col items-center gap-[10px] flex-shrink-0">
            <div className="relative flex items-center justify-center" style={{ width: '110px', height: '110px' }}>
              <div
                className="absolute rounded-full"
                style={{
                  inset: '-3px',
                  background: 'conic-gradient(#7C3AED 0%,#9D6BF5 50%,transparent 50%)',
                  animation: 'spin 3s linear infinite',
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  inset: '-6px',
                  background: 'conic-gradient(rgba(124,58,237,0.15) 0%,transparent 60%)',
                  animation: 'spin 4s linear infinite reverse',
                }}
              />
              <div
                className="rounded-full flex items-center justify-center relative z-10"
                style={{
                  width: '100px', height: '100px',
                  background: '#1A1A1F',
                  border: '2px solid rgba(255,255,255,0.07)',
                  boxShadow: '0 0 30px rgba(124,58,237,0.3)',
                }}
              >
                <span style={{ fontSize: '42px', lineHeight: 1 }}>🤖</span>
              </div>
            </div>

            <div className="text-[13px] font-bold">UGC.OS Agent</div>

            <div className="flex items-center gap-[5px] text-[11px] font-medium" style={{ color: '#22C55E' }}>
              <div
                className="w-[7px] h-[7px] rounded-full"
                style={{
                  background: '#22C55E',
                  boxShadow: '0 0 6px #22C55E',
                  animation: 'pulse-green 2s ease infinite',
                }}
              />
              Active
            </div>
          </div>

          <div className="flex-1">
            <div className="text-[15px] font-bold mb-[18px]">AI Agent Status</div>
            {STEPS.map((step, i) => (
              <PipelineProgress
                key={step.label}
                label={step.label}
                status={getStepStatus(i, activeVideo.status)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
