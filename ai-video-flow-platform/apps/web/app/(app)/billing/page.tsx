import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BillingClient } from '@/components/app/billing-client'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams

  const [creditsResult, txResult] = await Promise.all([
    supabase.from('credits').select('balance').eq('user_id', user.id).single(),
    supabase.from('credit_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
  ])

  return (
    <Suspense fallback={null}>
      <BillingClient
        balance={creditsResult.data?.balance ?? 0}
        transactions={txResult.data ?? []}
        showSuccess={params.success === 'true'}
      />
    </Suspense>
  )
}
