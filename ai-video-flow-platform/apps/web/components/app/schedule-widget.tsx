'use client'

type ScheduleItem = {
  time: string
  dayLabel?: string
  platform: 'instagram' | 'facebook' | 'tiktok'
  label: string
  status: 'posted' | 'progress' | 'upcoming'
}

const PLATFORM_ICONS: Record<string, { bg: string; icon: string }> = {
  instagram: { bg: '#E1306C', icon: 'IG' },
  facebook: { bg: '#1877F2', icon: 'FB' },
  tiktok: { bg: '#000000', icon: 'TT' },
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  posted: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', label: 'Posted' },
  progress: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: 'In progress' },
  upcoming: { bg: '#1A1A1F', color: '#52525B', label: 'Upcoming' },
}

const STATUS_DOT: Record<string, string> = {
  posted: '#22C55E',
  progress: '#F59E0B',
  upcoming: 'rgba(255,255,255,0.12)',
}

interface Props {
  items: ScheduleItem[]
  title?: string
}

export function ScheduleWidget({ items, title = "Today's Schedule" }: Props) {
  return (
    <div
      className="rounded-[16px] p-5"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[15px] font-bold">{title}</div>
        <span className="text-[11px] font-semibold" style={{ color: '#52525B' }}>
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-[12px]" style={{ color: '#52525B' }}>No posts scheduled</p>
          <p className="text-[11px] mt-1" style={{ color: '#3F3F46' }}>Generate a video to auto-schedule</p>
        </div>
      ) : (
        <div>
          {items.map((item, i) => {
            const platform = PLATFORM_ICONS[item.platform] ?? PLATFORM_ICONS['instagram']!
            const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE['upcoming']!
            const dot = STATUS_DOT[item.status] ?? STATUS_DOT['upcoming']!

            return (
              <div
                key={i}
                className="flex items-center gap-[10px] py-[9px]"
                style={i < items.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.07)' } : {}}
              >
                {/* Time + day label */}
                <div className="flex-shrink-0" style={{ minWidth: '64px' }}>
                  {item.dayLabel && (
                    <div style={{ fontSize: '9px', fontWeight: 600, color: '#3F3F46', lineHeight: 1, marginBottom: '2px' }}>
                      {item.dayLabel}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#52525B' }}>
                    {item.time}
                  </div>
                </div>

                <div className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: dot }} />

                <div
                  className="flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ width: '22px', height: '22px', borderRadius: '5px', background: platform.bg, fontSize: '9px' }}
                >
                  {platform.icon}
                </div>

                <span className="text-[12px] font-medium flex-1 truncate">{item.label}</span>

                <span
                  className="text-[10px] font-semibold px-[9px] py-[3px] rounded-full flex-shrink-0"
                  style={{
                    background: badge.bg,
                    color: badge.color,
                    border: item.status === 'upcoming' ? '1px solid rgba(255,255,255,0.07)' : undefined,
                  }}
                >
                  {badge.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type { ScheduleItem }
