import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { SUBSCRIPTION_TIERS } from '@/lib/stripe/packages'

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .single()

  if (existing?.status === 'active' || existing?.status === 'trialing') {
    return NextResponse.json({ error: 'already_subscribed' }, { status: 400 })
  }

  const { tier_id } = await request.json()
  const tier = SUBSCRIPTION_TIERS.find(t => t.id === tier_id)
  if (!tier) return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: tier.priceId, quantity: 1 }],
    payment_method_types: ['card'],
    success_url: `${origin}/billing?subscribed=true`,
    cancel_url: `${origin}/billing`,
    metadata: {
      user_id: user.id,
      tier_id: tier.id,
    },
    subscription_data: {
      metadata: { user_id: user.id, tier_id: tier.id },
    },
  })

  return NextResponse.json({ url: session.url })
}
