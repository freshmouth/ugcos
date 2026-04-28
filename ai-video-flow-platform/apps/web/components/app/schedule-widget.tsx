'use client'

type ScheduleItem = {
  time: string
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
}

export function ScheduleWidget({ items }: Props) {
  if (!items.length) {
    items = [
      { time: '8:00 AM', platform: 'instagram', label: 'Instagram Reel', status: 'upcoming' },
      { time: '12:00 PM', platform: 'facebook', label: 'Facebook Video', status: 'upcoming' },
      { time: '6:00 PM', platform: 'instagram', label: 'Instagram Reel', status: 'upcoming' },
    ]
  }

  return (
    <div
      className="rounded-[16px] p-5"
      style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[15px] font-bold">Today&apos;s Schedule</div>
        <button
          className="text-[11px] font-semibold"
          style={{ color: '#9D6BF5' }}
        >
          View Calendar
        </button>
      </div>

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
              <span className="text-[11px] font-medium w-[54px] flex-shrink-0" style={{ color: '#52525B' }}>
                {item.time}
              </span>
              <div
                className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                style={{ background: dot }}
              />
              <div
                className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ background: platform.bg }}
              >
                {platform.icon}
              </div>
              <span className="text-[12px] font-medium flex-1">{item.label}</span>
              <span
                className="text-[10px] font-semibold px-[9px] py-[3px] rounded-full"
                style={{ background: badge.bg, color: badge.color, border: item.status === 'upcoming' ? '1px solid rgba(255,255,255,0.07)' : undefined }}
              >
                {badge.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { ScheduleItem }
