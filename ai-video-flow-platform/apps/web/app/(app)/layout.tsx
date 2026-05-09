import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/app/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: subscription }, { data: profile }] = await Promise.all([
    supabase.from('subscriptions').select('tier, status, videos_used_this_cycle, cycle_reset_date').eq('user_id', user.id).single(),
    supabase.from('profiles').select('email, full_name, avatar_url').eq('id', user.id).single(),
  ])

  let daysUntilReset: number | null = null
  if (subscription?.cycle_reset_date) {
    const resetDate = new Date(subscription.cycle_reset_date)
    const today = new Date()
    const diff = Math.ceil((resetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    daysUntilReset = diff > 0 ? diff : 0
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#0C0C0F' }}>
      <Sidebar
        subscriptionTier={subscription?.tier ?? null}
        videosUsed={subscription?.videos_used_this_cycle ?? 0}
        daysUntilReset={daysUntilReset}
        userEmail={profile?.email ?? user.email ?? ''}
        userAvatar={profile?.avatar_url}
        userId={user.id}
      />
      <main className="flex-1 md:ml-[200px]">
        <div className="mx-auto px-4 py-6 md:px-8" style={{ maxWidth: '1400px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
