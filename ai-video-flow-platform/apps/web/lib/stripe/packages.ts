export const CREDIT_PACKAGES = [
  {
    id: 'starter',
    label: 'Starter',
    credits: 60,
    price: 10,
    priceId: 'price_starter_placeholder',
    description: '2 videos',
  },
  {
    id: 'growth',
    label: 'Growth',
    credits: 150,
    price: 20,
    priceId: 'price_growth_placeholder',
    description: '5 videos',
    badge: 'Best Value',
  },
  {
    id: 'pro',
    label: 'Pro',
    credits: 360,
    price: 40,
    priceId: 'price_pro_placeholder',
    description: '12 videos',
  },
] as const

export type PackageId = (typeof CREDIT_PACKAGES)[number]['id']
