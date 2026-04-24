# Phase 5 — Billing & Credits (Stripe)

## Pre-flight check
Before writing anything:
1. Confirm Stripe account has STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET set
2. Confirm dashboard is rendering credits from Supabase (Phase 4 done)
3. List every file you will create and modify
4. Wait for approval before writing code

## Stripe products to create (do this manually in Stripe dashboard first)
Then hardcode the price IDs returned:

| Package    | Credits | Price  | Description        |
|------------|---------|--------|--------------------|
| Starter    | 60      | $10    | 2 videos           |
| Growth     | 150     | $20    | 5 videos           |
| Pro        | 360     | $40    | 12 videos          |

After creating in Stripe, store price IDs in:
/lib/stripe/packages.ts
```typescript
export const CREDIT_PACKAGES = [
  {
    id: 'starter',
    label: 'Starter',
    credits: 60,
    price: 10,
    priceId: 'price_XXXX',   // paste from Stripe
    description: '2 videos',
  },
  {
    id: 'growth',
    label: 'Growth',
    credits: 150,
    price: 20,
    priceId: 'price_XXXX',   // paste from Stripe
    description: '5 videos',
    badge: 'Best Value',
  },
  {
    id: 'pro',
    label: 'Pro',
    credits: 360,
    price: 40,
    priceId: 'price_XXXX',   // paste from Stripe
    description: '12 videos',
  },
]
```

## API routes to create

### /app/api/billing/create-checkout/route.ts (POST)
```typescript
// 1. Verify session (reject if unauthenticated)
// 2. Get { package_id } from body
// 3. Find package in CREDIT_PACKAGES
// 4. Create Stripe Checkout session:
//    - mode: 'payment'
//    - line_items: [{ price: package.priceId, quantity: 1 }]
//    - payment_method_types: ['card']  // Stripe handles PayPal via Link
//    - success_url: /billing?success=true
//    - cancel_url: /billing
//    - metadata: { user_id, credits: package.credits }
// 5. Return { url: session.url }
```

### /app/api/billing/webhook/route.ts (POST)
```typescript
// 1. Verify Stripe signature using STRIPE_WEBHOOK_SECRET
// 2. Handle event: checkout.session.completed
// 3. Extract user_id and credits from session.metadata
// 4. Use SUPABASE_SERVICE_ROLE_KEY (bypass RLS — webhook has no user session):
//    - UPDATE credits SET balance = balance + credits WHERE user_id
//    - INSERT credit_transactions (amount: +credits, reason: 'purchase', stripe_payment_id)
// 5. Return 200 OK

// CRITICAL: Use raw body for signature verification (not JSON.parse)
// In Next.js App Router: const body = await request.text()
```

## Billing page: /app/(app)/billing/page.tsx

### Success toast
If URL param ?success=true → show toast: "Credits added! 🎉" then clear param.

### Current balance section
Large display at top:
```
🪙  120 credits
    = 4 videos remaining
[████████░░░░░░░░░░░░]  Progress bar
```

### Top Up section
Heading: "Add Credits"
3 package cards in a row (stack on mobile):

Card design:
```
┌──────────────────────┐
│  [Best Value badge]  │  ← only on Growth
│  Growth              │
│  150 credits         │
│  ─────────────       │
│  5 videos            │
│                      │
│  $20 USD             │
│  [ Buy Now ]         │
└──────────────────────┘
```
Card: bg #111111, border border-gray-800, rounded-xl, p-6
Selected state on hover: border-violet-500
Best Value badge: bg #7C3AED, text-white, text-xs, rounded-full, px-2 py-0.5

[ Buy Now ] → POST /api/billing/create-checkout → redirect to session.url

### Transaction history section
Heading: "Transaction History"
Table:
  Date | Type | Credits | Balance After

Type formatting:
  signup_bonus     → "Welcome bonus 🎁"
  purchase         → "Top up — Starter/Growth/Pro"
  video_generated  → "Video generated"
  refund           → "Refund"

Amount formatting:
  positive → green "+60 credits"
  negative → red   "−30 credits"

Empty state: "No transactions yet"

## Low credit upsell modal
This component is used across the app (dashboard, generate page):
/components/app/low-credits-modal.tsx

Trigger: when user tries to generate with balance < 30
Content:
  - "Not enough credits" heading
  - "You need 30 credits to generate a video. Add credits to continue."
  - Show 3 package options inline
  - [ Add Credits ] button per package → same checkout flow
  - [ Cancel ] link

## After completing this phase
1. Test Stripe Checkout flow in test mode (use card 4242 4242 4242 4242)
2. Confirm credits updated in Supabase after webhook fires
3. Confirm transaction appears in history
4. Test webhook locally using Stripe CLI: stripe listen --forward-to localhost:3000/api/billing/webhook
5. Update CLAUDE.md Phase 5 checkbox to [x]
6. git commit -m "checkpoint: billing complete"

## Do NOT do in this phase
- No video generation
- No settings page
- No cron changes
