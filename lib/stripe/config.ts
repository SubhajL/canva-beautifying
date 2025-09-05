import Stripe from 'stripe';

// Only initialize Stripe on the server side
let stripe: Stripe | null = null;

if (typeof window === 'undefined' && process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
  });
}

export { stripe };

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || '';

export const SUBSCRIPTION_TIERS = {
  FREE: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null, // No Stripe price ID for free tier
    features: {
      monthlyCredits: 10,
      maxFileSizeMb: 5,
      batchSize: 1,
      aiModels: ['gemini-2.0-flash'],
      exportFormats: ['png', 'pdf'],
      support: 'community',
      apiAccess: false,
    },
  },
  BASIC: {
    id: 'basic',
    name: 'Basic',
    price: 9.99,
    priceId: process.env.STRIPE_BASIC_PRICE_ID || '',
    features: {
      monthlyCredits: 100,
      maxFileSizeMb: 20,
      batchSize: 5,
      aiModels: ['gemini-2.0-flash', 'gpt-4o-mini'],
      exportFormats: ['png', 'pdf', 'svg'],
      support: 'email',
      apiAccess: false,
    },
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 29.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    features: {
      monthlyCredits: 500,
      maxFileSizeMb: 50,
      batchSize: 20,
      aiModels: ['gemini-2.0-flash', 'gpt-4o-mini', 'gpt-4o', 'claude-3-haiku'],
      exportFormats: ['png', 'pdf', 'svg', 'pptx'],
      support: 'priority',
      apiAccess: true,
    },
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium',
    price: 99.99,
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID || '',
    features: {
      monthlyCredits: 2000,
      maxFileSizeMb: 100,
      batchSize: 50,
      aiModels: ['all'],
      exportFormats: ['all'],
      support: 'dedicated',
      apiAccess: true,
      customBranding: true,
      teamCollaboration: true,
    },
  },
} as const;

export type SubscriptionTierId = keyof typeof SUBSCRIPTION_TIERS;
export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[SubscriptionTierId];

export const getSubscriptionTier = (tierId: string): SubscriptionTier => {
  const tier = SUBSCRIPTION_TIERS[tierId.toUpperCase() as SubscriptionTierId];
  if (!tier) {
    return SUBSCRIPTION_TIERS.FREE;
  }
  return tier;
};

export const getTierByPriceId = (priceId: string): SubscriptionTier | null => {
  return Object.values(SUBSCRIPTION_TIERS).find(tier => tier.priceId === priceId) || null;
};

export const canAccessFeature = (userTier: string, feature: string): boolean => {
  const tier = getSubscriptionTier(userTier);
  return tier.features[feature as keyof typeof tier.features] === true;
};

export const getAvailableModels = (userTier: string): string[] => {
  const tier = getSubscriptionTier(userTier);
  const models = tier.features.aiModels;
  
  if (models.includes('all')) {
    return [
      'gemini-2.0-flash',
      'gpt-4o-mini',
      'gpt-4o',
      'claude-3-haiku',
      'claude-3-5-sonnet',
      'dall-e-3',
      'flux-pro',
    ];
  }
  
  return models;
};