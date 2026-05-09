# Phase 5 — Billing: Stripe Subscriptions

## Pre-flight check
Before writing anything:
1. Confirm Phase 4 dashboard is working
2. Confirm credits table does NOT exist — this platform uses subscriptions, not credits
3. List every file you will create and every file you will modify
4. Wait for approval before writing code

## Key model change
This is a monthly subscription platform — NOT a pay-per-video credits system.
Delete any credits or credit_transactions logic if it was scaffolded in earlier phases.
Access is gated by active Stripe subscription status + monthly video quota.

## Stripe products to create manually in Stripe dashboard first

| Tier    | Price/mo | Videos/mo | Brands | Avatars |
|---------|----------|-----------|--------|---------|
| Starter | $1,999   | 30        | 1      | 1       |
| Growth  | $3,499   | 60        | 3      | 5       |
| Scale   | $5,000+  | Unlimited | ∞      | ∞       |

After creating, store price IDs in:

### /lib/stripe/packages.ts
```typescript
export const SUBSCRIPTION_TIERS = [
  {
    id: 'starter',
    label: 'Starter',
    price: 1999,
    priceId: 'price_XXXX',
    videosPerMonth: 30,
    brands: 1,
    avatars: 1,
    highlighted: false,
    features: [
      '30 videos per month',
      '1 brand',
      '1 avatar',
      'Auto posting to Instagram + Facebook',
      'Analytics dashboard',
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    price: 3499,
    priceId: 'price_XXXX',
    videosPerMonth: 60,
    brands: 3,
    avatars: 5,
    highlighted: true,
    features: [
      '60 videos per month',
      'Multiple avatars',
      'Multi-platform optimization',
      'Comment automation',
      'DM flows',
    ],
  },
  {
    id: 'scale',
    label: 'Scale',
    price: 5000,
    priceId: 'price_XXXX',
    videosPerMonth: null,    // null = unlimited
    brands: null,
    avatars: null,
    highlighted: false,
    features: [
      'Unlimited generation queue',
      'Custom hooks engine',
      'A/B testing',
      'Funnel integrations',
      'Ad creatives included',
    ],
  },
] as const

export type TierId = 'starter' | 'growth' | 'scale'
export const getTierById = (id: TierId) => SUBSCRIPTION_TIERS.find(t => t.id === id)
export const getTierByPriceId = (priceId: string) => SUBSCRIPTION_TIERS.find(t => t.priceId === priceId)
```

## Database changes

### DROP if credits were created in Phase 1
```sql
drop table if exists credit_transactions;
drop table if exists credits;
```

### ADD subscriptions table
```sql
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references profiles(id) on delete cascade not null unique,
  tier                   text not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id     text not null,
  status                 text not null default 'active',
  -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'
  videos_used_this_cycle integer default 0,
  videos_limit           integer,             -- null = unlimited (Scale)
  cycle_start_date       timestamptz,
  cycle_reset_date       timestamptz,         -- next billing date = quota reset date
  cancel_at_period_end   boolean default false,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

alter table subscriptions enable row level security;

create policy "users view own subscription"
  on subscriptions for select using (auth.uid() = user_id);

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute procedure update_updated_at();

create index idx_subscriptions_user_id on subscriptions(user_id);
create index idx_subscriptions_stripe_id on subscriptions(stripe_subscription_id);
```

## API routes

### POST /app/api/billing/create-checkout/route.ts
```
1. Verify session
2. If user already has active subscription → return 400 'already_subscribed'
3. Get { tier_id } from body, find tier in SUBSCRIPTION_TIERS
4. Create or retrieve Stripe customer (check subscriptions table first)
5. Create Stripe Checkout session:
   - mode: 'subscription'
   - line_items: [{ price: tier.priceId, quantity: 1 }]
   - customer: stripeCustomerId
   - success_url: /dashboard?subscribed=true
   - cancel_url: /billing
   - metadata: { user_id, tier_id }
   - subscription_data.metadata: { user_id, tier_id }
6. Return { url: session.url }
```

### POST /app/api/billing/portal/route.ts
```
1. Verify session
2. Get stripe_customer_id from subscriptions table
3. stripe.billingPortal.sessions.create({
     customer: stripeCustomerId,
     return_url: NEXT_PUBLIC_SITE_URL + '/billing'
   })
4. Return { url }
Stripe portal handles: upgrade, downgrade, cancel, payment method update
```

### POST /app/api/billing/webhook/route.ts
```
CRITICAL: Use raw body → const body = await request.text()
Verify: stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)

Handle:

checkout.session.completed
  → INSERT subscriptions row
  → videos_used_this_cycle = 0
  → videos_limit = tier.videosPerMonth (null for Scale)
  → cycle_reset_date = subscription.current_period_end

customer.subscription.updated
  → UPDATE status, cycle_reset_date, cancel_at_period_end
  → If tier changed: UPDATE tier + videos_limit

customer.subscription.deleted
  → UPDATE status = 'canceled'

invoice.payment_failed
  → UPDATE status = 'past_due'
  → Send email alert to user

invoice.paid (monthly renewal)
  → RESET videos_used_this_cycle = 0
  → UPDATE cycle_reset_date to next period_end

Always return 200 — Stripe retries on non-200
```

## DB helpers: /lib/db/subscriptions.ts
```typescript
getSubscription(userId)
hasActiveSubscription(userId)  → status === 'active' || 'trialing'
getRemainingVideos(userId)     → videos_limit === null ? Infinity : limit - used
incrementVideoCount(userId)    → videos_used_this_cycle += 1
resetVideoCount(userId)        → videos_used_this_cycle = 0
```

## Middleware update
For all /dashboard, /generate, /settings routes:
- No active subscription → redirect /billing?reason=no_subscription
- status = 'past_due' → allow access + show payment warning banner
- status = 'canceled' → redirect /billing?reason=canceled

## Billing page: /app/(app)/billing/page.tsx

### No subscription state
3 tier pricing cards with full feature lists.
Growth card has "Most Popular" badge.
[ Get Started ] on each → POST /api/billing/create-checkout → redirect to Stripe

### Active subscription state
Show current plan card:
- Tier name + price
- Status badge (green "Active")
- Video usage progress bar: used / limit (or "Unlimited" for Scale)
- Next reset date
- Cancel at period end warning if applicable
- [ Manage Subscription ] → POST /api/billing/portal → redirect to Stripe portal

### Past due state
Red warning banner: "Payment failed — update your payment method to restore access"
[ Update Payment Method ] → Stripe portal

### Canceled state
Show pricing cards again with message:
"Your subscription ended on [date]. Resubscribe to continue."

### Success toast
?subscribed=true → "Welcome to AI Video Flow 🎉 Let's make your first video."

## After completing this phase
1. Test Stripe checkout in test mode (4242 4242 4242 4242)
2. Confirm subscriptions row created in Supabase after webhook
3. Test portal opens, cancel + reactivate works
4. Test invoice.paid resets videos_used_this_cycle = 0
5. Test middleware blocks /dashboard with no subscription
6. Stripe CLI local test: stripe listen --forward-to localhost:3000/api/billing/webhook
7. Update CLAUDE.md Phase 5 checkbox to [x]
8. git commit -m "checkpoint: subscription billing complete"

## Do NOT do in this phase
- No credits system — does not exist
- No video generation logic
- No cron changes
