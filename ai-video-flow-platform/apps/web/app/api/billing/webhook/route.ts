import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id
    const credits = Number(session.metadata?.credits)

    if (!userId || !credits) {
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    const { data: current } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single()

    await supabase
      .from('credits')
      .update({ balance: (current?.balance ?? 0) + credits })
      .eq('user_id', userId)

    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: credits,
      reason: 'purchase',
      stripe_payment_id: session.payment_intent as string,
    })
  }

  return NextResponse.json({ received: true })
}
