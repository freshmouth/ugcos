export const SUBSCRIPTION_TIERS = [
  {
    id: 'starter',
    label: 'Starter',
    price: 1999,
    priceId: 'price_starter_placeholder',
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
    priceId: 'price_growth_placeholder',
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
    priceId: 'price_scale_placeholder',
    videosPerMonth: null,
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
