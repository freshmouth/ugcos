import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'
import { getTierByPriceId } from '@/lib/stripe/packages'

function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = serviceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const userId = session.metadata?.user_id
      const tierId = session.metadata?.tier_id
      if (!userId || !tierId) break

      const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const item = stripeSubscription.items.data[0]
      const priceId = item?.price.id
      const tier = getTierByPriceId(priceId ?? '') ?? getTierByPriceId('')
      const videosLimit = (tier as { videosPerMonth: number | null } | undefined)?.videosPerMonth ?? null
      // period dates: prefer item.period, fall back to root-level (cast for older SDK compat)
      const period = (item as unknown as { period?: { start: number; end: number } })?.period
      const sub = stripeSubscription as unknown as { current_period_start?: number; current_period_end?: number }
      const periodStart = period?.start ?? sub.current_period_start ?? 0
      const periodEnd = period?.end ?? sub.current_period_end ?? 0

      await supabase.from('subscriptions').upsert({
        user_id: userId,
        tier: tierId,
        stripe_subscription_id: stripeSubscription.id,
        stripe_customer_id: stripeSubscription.customer as string,
        status: stripeSubscription.status,
        videos_used_this_cycle: 0,
        videos_limit: videosLimit,
        cycle_start_date: new Date(periodStart * 1000).toISOString(),
        cycle_reset_date: new Date(periodEnd * 1000).toISOString(),
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      }, { onConflict: 'user_id' })
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.user_id
      if (!userId) break

      const updItem = sub.items.data[0]
      const priceId = updItem?.price.id
      const tier = getTierByPriceId(priceId ?? '')
      const tierId = tier?.id
      const videosLimit = tier?.videosPerMonth ?? null
      const updPeriod = (updItem as unknown as { period?: { end: number } })?.period
      const updSub = sub as unknown as { current_period_end?: number }
      const updEnd = updPeriod?.end ?? updSub.current_period_end ?? 0

      await supabase.from('subscriptions').update({
        status: sub.status,
        tier: tierId ?? undefined,
        videos_limit: videosLimit,
        cycle_reset_date: new Date(updEnd * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
      }).eq('stripe_subscription_id', sub.id)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await supabase.from('subscriptions').update({ status: 'canceled' })
        .eq('stripe_subscription_id', sub.id)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as unknown as { subscription?: string }
      if (invoice.subscription) {
        await supabase.from('subscriptions').update({ status: 'past_due' })
          .eq('stripe_subscription_id', invoice.subscription)
      }
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as unknown as { subscription?: string; billing_reason?: string }
      if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
        const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const renewItem = stripeSub.items.data[0]
        const renewPeriod = (renewItem as unknown as { period?: { end: number } })?.period
        const renewSub = stripeSub as unknown as { current_period_end?: number }
        const renewEnd = renewPeriod?.end ?? renewSub.current_period_end ?? 0
        await supabase.from('subscriptions').update({
          videos_used_this_cycle: 0,
          status: 'active',
          cycle_reset_date: new Date(renewEnd * 1000).toISOString(),
        }).eq('stripe_subscription_id', invoice.subscription as string)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
