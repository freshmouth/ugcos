'use client'

const STEPS = [
  { label: 'Your Product' },
  { label: 'Photos' },
  { label: 'Content Style' },
  { label: 'Social Media' },
]

export function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-4 py-6">
      {STEPS.map((step, i) => {
        const stepNum = i + 1
        const isDone = stepNum < currentStep
        const isActive = stepNum === currentStep
        return (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors"
                style={{
                  background: isDone ? '#16A34A' : isActive ? '#7C3AED' : 'transparent',
                  border: isDone || isActive ? 'none' : '2px solid #374151',
                  color: isDone || isActive ? '#fff' : '#6B7280',
                }}
              >
                {isDone ? '✓' : stepNum}
              </div>
              <span className="text-xs" style={{ color: isActive ? '#fff' : '#6B7280' }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="mb-5 h-px w-8"
                style={{ background: stepNum < currentStep ? '#16A34A' : '#374151' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
