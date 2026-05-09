import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BillingClient } from '@/components/app/billing-client'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <Suspense fallback={null}>
      <BillingClient
        subscription={subscription ?? null}
        showSubscribed={params.subscribed === 'true'}
      />
    </Suspense>
  )
}
