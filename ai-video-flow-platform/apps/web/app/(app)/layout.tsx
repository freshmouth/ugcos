import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/app/sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: credits }, { data: profile }] = await Promise.all([
    supabase.from('credits').select('balance').eq('user_id', user.id).single(),
    supabase.from('profiles').select('email, full_name, avatar_url').eq('id', user.id).single(),
  ])

  return (
    <div className="flex min-h-screen" style={{ background: '#0A0A0A' }}>
      <Sidebar
        creditBalance={credits?.balance ?? 0}
        userEmail={profile?.email ?? user.email ?? ''}
        userAvatar={profile?.avatar_url}
        userId={user.id}
      />
      <main className="flex-1 md:ml-60">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
          {children}
        </div>
      </main>
    </div>
  )
}
