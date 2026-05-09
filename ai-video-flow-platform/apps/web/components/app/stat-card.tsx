'use client'

import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string
  change?: string
  changeLabel?: string
  icon: ReactNode
  changePositive?: boolean
}

export function StatCard({ label, value, change, changeLabel, icon, changePositive = true }: StatCardProps) {
  return (
    <div
      className="rounded-[16px] p-[18px_16px] transition-colors"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-medium leading-tight" style={{ color: '#A1A1AA' }}>{label}</span>
        <div
          className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(124,58,237,0.15)' }}
        >
          <span style={{ color: '#9D6BF5' }}>{icon}</span>
        </div>
      </div>
      <div className="text-[26px] font-bold tracking-[-1px] leading-none mb-[5px]">{value}</div>
      {change && (
        <div className="flex items-center gap-[3px] text-[11px] font-medium" style={{ color: changePositive ? '#22C55E' : '#EF4444' }}>
          {changePositive ? '↑' : '↓'} {change}{' '}
          <span className="font-normal" style={{ color: '#52525B' }}>{changeLabel}</span>
        </div>
      )}
    </div>
  )
}
