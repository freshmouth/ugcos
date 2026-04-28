'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PipelineProgress } from './pipeline-progress'
import type { StepStatus } from './pipeline-progress'

type VideoStatus =
  | 'pending' | 'analyzing' | 'scripting' | 'generating_images'
  | 'generating_video' | 'assembling' | 'captioning' | 'posting' | 'done' | 'failed'

const STEPS = [
  { label: 'Finding winning hooks', activeOn: 'analyzing' },
  { label: 'Generating script', activeOn: 'scripting' },
  { label: 'Creating avatar & scenes', activeOn: 'generating_images' },
  { label: 'Editing video', activeOn: 'generating_video' },
  { label: 'Adding captions', activeOn: 'assembling' },
  { label: 'Auto posting', activeOn: 'captioning' },
] as const

const STATUS_ORDER: VideoStatus[] = [
  'pending', 'analyzing', 'scripting', 'generating_images',
  'generating_video', 'assembling', 'captioning', 'posting', 'done',
]

function getStepStatus(stepIndex: number, currentStatus: VideoStatus): StepStatus {
  if (currentStatus === 'done') return 'done'
  if (currentStatus === 'failed') return stepIndex === 0 ? 'pending' : 'pending'

  const current = STATUS_ORDER.indexOf(currentStatus)
  // Step i becomes "done" after status passes its activeOn stage
  const stepActive = STATUS_ORDER.indexOf(STEPS[stepIndex]!.activeOn)

  if (current > stepActive) return 'done'
  if (current === stepActive) return 'progress'
  return 'pending'
}

interface Props {
  userId: string
  initialStatus: VideoStatus | null
  initialVideoId: string | null
}

export function AgentStatusWidget({ userId, initialStatus, initialVideoId }: Props) {
  const [status, setStatus] = useState<VideoStatus | null>(initialStatus)
  const [videoId, setVideoId] = useState<string | null>(initialVideoId)
  const isActive = status && status !== 'done' && status !== 'failed' && status !== null

  useEffect(() => {
    const supabase = createClient()

    const videoChannel = supabase
      .channel('active-video')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; status: VideoStatus }
          const statusOrder = STATUS_ORDER.indexOf(updated.status)
          const currentOrder = status ? STATUS_ORDER.indexOf(status) : -1
          if (statusOrder >= currentOrder) {
            setStatus(updated.status)
            setVideoId(updated.id)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(videoChannel) }
  }, [userId, status])

  const agentActive = isActive

  return (
    <div
      className="rounded-[16px] p-6 flex gap-7 items-start"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Avatar column */}
      <div className="flex flex-col items-center gap-[10px] flex-shrink-0">
        <div
          className="w-[110px] h-[110px] rounded-full relative flex items-center justify-center"
          style={{
            background: agentActive
              ? 'conic-gradient(#7C3AED 0%,#9D6BF5 50%,transparent 50%)'
              : 'rgba(255,255,255,0.07)',
          }}
        >
          {agentActive && (
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          )}
          {agentActive && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(rgba(124,58,237,0.2) 0%,transparent 60%)',
                animation: 'spin 4s linear infinite reverse',
              }}
            />
          )}
          <div
            className="w-[100px] h-[100px] rounded-full flex items-center justify-center relative z-10"
            style={{
              background: '#1A1A1F',
              border: '2px solid rgba(255,255,255,0.07)',
              boxShadow: '0 0 30px rgba(124,58,237,0.2)',
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
          <style>{`@keyframes pulse-green{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
          Active
        </div>
      </div>

      {/* Steps column */}
      <div className="flex-1">
        <div className="text-[15px] font-bold mb-[18px]">AI Agent Status</div>
        <div>
          {STEPS.map((step, i) => (
            <PipelineProgress
              key={step.label}
              label={step.label}
              status={status ? getStepStatus(i, status) : 'pending'}
            />
          ))}
        </div>

        {status === 'done' && (
          <div className="mt-3 text-[12px] font-medium" style={{ color: '#22C55E' }}>
            ✓ Video complete and posted
          </div>
        )}
        {status === 'failed' && (
          <div className="mt-3 text-[12px] font-medium" style={{ color: '#EF4444' }}>
            Pipeline failed — {videoId && (
              <a
                href={`/api/pipeline/retry/${videoId}`}
                className="underline"
              >retry</a>
            )}
          </div>
        )}
        {!status && (
          <div className="mt-3 text-[12px]" style={{ color: '#52525B' }}>
            No active generation — trigger one from Generate
          </div>
        )}
      </div>
    </div>
  )
}
