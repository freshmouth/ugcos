'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
        <path d="M2 11h8V2H2v9zm0 7h8v-5H2v5zm10 0h6v-9h-6v9zm0-16v5h6V2h-6z" />
      </svg>
    ),
  },
  {
    label: 'Generate Video',
    href: '/generate',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'My Videos',
    href: '/videos',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
        <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Billing',
    href: '/billing',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
        <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
      </svg>
    ),
  },
]

const TIER_LABELS: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  scale: 'Scale Pro',
}
const TIER_QUOTAS: Record<string, number> = { starter: 30, growth: 60, scale: 999 }

interface SidebarProps {
  subscriptionTier: string | null
  videosUsed: number
  daysUntilReset: number | null
  userEmail: string
  userAvatar?: string | null
  userId: string
}

export function Sidebar({ subscriptionTier, videosUsed, daysUntilReset, userEmail, userId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeBrand = searchParams.get('brand')

  const tier = subscriptionTier ?? 'starter'
  const quota = TIER_QUOTAS[tier] ?? 30
  const usagePct = Math.min((videosUsed / (quota === 999 ? 999 : quota)) * 100, 100)
  const tierLabel = TIER_LABELS[tier] ?? 'Starter'

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="fixed left-0 top-0 bottom-0 z-50 hidden md:flex flex-col overflow-y-auto"
        style={{
          width: '200px',
          background: '#0C0C0F',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-4 flex-shrink-0"
          style={{ height: '64px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="flex items-center justify-center rounded-[7px] flex-shrink-0"
            style={{ width: '28px', height: '28px', background: '#7C3AED' }}
          >
            <svg viewBox="0 0 12 12" fill="white" width="12" height="12">
              <path d="M3 2l7 4-7 4V2z" />
            </svg>
          </div>
          <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.3px', color: '#fff' }}>
            UGC<span style={{ color: '#9D6BF5' }}>.OS</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-[10px]">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            const navHref = activeBrand ? `${item.href}?brand=${activeBrand}` : item.href
            return (
              <Link
                key={item.href}
                href={navHref}
                className="flex items-center gap-[10px] rounded-[8px] mb-[2px] transition-all"
                style={{
                  padding: '9px 10px',
                  fontSize: '13px',
                  fontWeight: active ? 600 : 500,
                  color: active ? '#9D6BF5' : '#A1A1AA',
                  background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = '#1E1E24'
                    e.currentTarget.style.color = '#fff'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#A1A1AA'
                  }
                }}
              >
                <span style={{ opacity: active ? 1 : 0.8, display: 'flex', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: Plan card + user */}
        <div className="flex-shrink-0" style={{ padding: '12px 10px 16px' }}>
          {/* Plan card */}
          <div
            className="rounded-[12px] p-3 mb-[10px]"
            style={{ background: '#141418', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              Current Plan
            </div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
              {tierLabel}
            </div>
            <div style={{ fontSize: '11px', color: '#A1A1AA', marginBottom: '8px' }}>
              {videosUsed} / {quota === 999 ? '∞' : quota} videos
            </div>
            <div
              className="rounded-full overflow-hidden mb-[6px]"
              style={{ height: '3px', background: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${usagePct}%`, background: 'linear-gradient(90deg,#7C3AED,#9D6BF5)' }}
              />
            </div>
            {daysUntilReset !== null && (
              <div style={{ fontSize: '10px', color: '#52525B', marginBottom: '10px' }}>
                Resets in {daysUntilReset} days
              </div>
            )}
            <Link
              href="/billing"
              className="flex items-center justify-center gap-[6px] w-full rounded-[8px] transition-colors"
              style={{
                padding: '8px',
                background: 'rgba(124,58,237,0.15)',
                border: '1px solid rgba(124,58,237,0.3)',
                color: '#9D6BF5',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="11" height="11">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Upgrade Plan
            </Link>
          </div>

          {/* User / sign out */}
          <button
            onClick={signOut}
            className="flex items-center gap-[10px] w-full rounded-[12px] p-[10px] transition-colors text-left"
            onMouseEnter={e => { e.currentTarget.style.background = '#1E1E24' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div
              className="rounded-[6px] flex items-center justify-center flex-shrink-0 text-[13px] font-bold text-white"
              style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg,#c8a882,#a07850)' }}
            >
              {userEmail[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0">
              <div className="truncate" style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                {userEmail.split('@')[0]}
              </div>
              <div style={{ fontSize: '10px', color: '#52525B' }}>Sign out</div>
            </div>
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between md:hidden"
        style={{
          height: '56px',
          padding: '0 16px',
          background: 'rgba(12,12,15,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-center gap-2">
          <div style={{ width: '24px', height: '24px', background: '#7C3AED', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 12 12" fill="white" width="10" height="10">
              <path d="M3 2l7 4-7 4V2z" />
            </svg>
          </div>
          <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-0.3px', color: '#fff' }}>
            UGC<span style={{ color: '#9D6BF5' }}>.OS</span>
          </span>
        </div>
        <button onClick={signOut} style={{ fontSize: '13px', color: '#A1A1AA' }}>Sign out</button>
      </div>
      <div className="h-14 md:hidden" />
    </>
  )
}
