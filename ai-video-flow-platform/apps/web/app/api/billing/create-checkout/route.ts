import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { CREDIT_PACKAGES } from '@/lib/stripe/packages'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { package_id } = await request.json()
  const pkg = CREDIT_PACKAGES.find(p => p.id === package_id)
  if (!pkg) return NextResponse.json({ error: 'Invalid package' }, { status: 400 })

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: pkg.priceId, quantity: 1 }],
    payment_method_types: ['card'],
    success_url: `${origin}/billing?success=true`,
    cancel_url: `${origin}/billing`,
    metadata: {
      user_id: user.id,
      credits: String(pkg.credits),
    },
  })

  return NextResponse.json({ url: session.url })
}
