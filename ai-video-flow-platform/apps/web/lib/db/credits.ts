import { createClient } from '@/lib/supabase/server'

export async function getCreditBalance(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data?.balance ?? 0
}

export async function getTransactions(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data
}
