import { createClient } from '@/lib/supabase/server'

export type Subscription = {
  id: string
  user_id: string
  tier: string
  stripe_subscription_id: string
  stripe_customer_id: string
  status: string
  videos_used_this_cycle: number
  videos_limit: number | null
  cycle_start_date: string | null
  cycle_reset_date: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data ?? null
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await getSubscription(userId)
  return sub?.status === 'active' || sub?.status === 'trialing'
}

export async function getRemainingVideos(userId: string): Promise<number> {
  const sub = await getSubscription(userId)
  if (!sub) return 0
  if (sub.videos_limit === null) return Infinity
  return Math.max(0, sub.videos_limit - sub.videos_used_this_cycle)
}

export async function incrementVideoCount(userId: string): Promise<void> {
  const supabase = await createClient()
  const sub = await getSubscription(userId)
  if (!sub) return
  await supabase
    .from('subscriptions')
    .update({ videos_used_this_cycle: sub.videos_used_this_cycle + 1 })
    .eq('user_id', userId)
}

export async function resetVideoCount(userId: string): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('subscriptions')
    .update({ videos_used_this_cycle: 0 })
    .eq('user_id', userId)
}
