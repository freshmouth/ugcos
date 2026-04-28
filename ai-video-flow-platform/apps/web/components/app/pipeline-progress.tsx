type StepStatus = 'done' | 'progress' | 'pending'

interface PipelineProgressProps {
  label: string
  status: StepStatus
}

export function PipelineProgress({ label, status }: PipelineProgressProps) {
  return (
    <div
      className="flex items-center justify-between py-[10px] text-[12px]"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', color: '#A1A1AA' }}
    >
      <span>{label}</span>

      {status === 'done' && (
        <div className="flex items-center gap-[5px] text-[11px] font-semibold" style={{ color: '#22C55E' }}>
          Completed
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(34,197,94,0.12)' }}
          >
            <svg viewBox="0 0 9 9" fill="none" width="9" height="9">
              <path d="M1.5 4.5l2 2L7.5 2" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}

      {status === 'progress' && (
        <div className="flex items-center gap-[5px] text-[11px] font-semibold" style={{ color: '#9D6BF5' }}>
          In progress
          <div
            className="w-[14px] h-[14px] rounded-full flex-shrink-0"
            style={{
              border: '2px solid rgba(124,58,237,0.3)',
              borderTopColor: '#9D6BF5',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      {status === 'pending' && (
        <span className="text-[11px]" style={{ color: '#52525B' }}>Pending</span>
      )}
    </div>
  )
}

export type { StepStatus }
