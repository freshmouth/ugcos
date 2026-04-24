'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
  { label: 'Generate Video', href: '/generate', icon: '▶' },
  { label: 'My Videos', href: '/videos', icon: '🎬' },
  { label: 'Settings', href: '/settings', icon: '⚙️' },
  { label: 'Billing', href: '/billing', icon: '💳' },
]

interface SidebarProps {
  creditBalance: number
  userEmail: string
  userAvatar?: string | null
  userId: string
}

export function Sidebar({ creditBalance, userEmail, userAvatar, userId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="fixed left-0 top-0 hidden h-screen w-60 flex-col md:flex"
        style={{ background: '#111111', borderRight: '1px solid #1F2937' }}
      >
        <div className="p-6">
          <div className="text-lg font-bold text-white">▶ AI Video Flow</div>
        </div>

        <nav className="flex-1 px-3">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: active ? '#fff' : '#9CA3AF',
                  background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                  borderLeft: active ? '2px solid #7C3AED' : '2px solid transparent',
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-4" style={{ borderColor: '#1F2937' }}>
          <div className="mb-3 flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: 'rgba(124,58,237,0.1)' }}>
            <span>🪙</span>
            <span className="text-sm font-semibold text-white">{creditBalance} credits</span>
          </div>
          <div className="mb-2 flex items-center gap-2">
            {userAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: '#7C3AED' }}>
                {userEmail[0]?.toUpperCase()}
              </div>
            )}
            <span className="truncate text-xs" style={{ color: '#9CA3AF' }}>{userEmail}</span>
          </div>
          <button onClick={signOut} className="w-full rounded-lg py-2 text-sm font-medium transition-opacity hover:opacity-80" style={{ color: '#9CA3AF' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile: top bar */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3 md:hidden" style={{ background: '#111111', borderBottom: '1px solid #1F2937' }}>
        <div className="font-bold text-white">▶ AI Video Flow</div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white">🪙 {creditBalance}</span>
          <button onClick={signOut} className="text-sm" style={{ color: '#9CA3AF' }}>Sign out</button>
        </div>
      </div>
      <div className="h-14 md:hidden" />
    </>
  )
}
