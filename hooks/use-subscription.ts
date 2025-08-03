import { useAuth } from '@/contexts/auth-context';
import { SUBSCRIPTION_TIERS, getSubscriptionTier, getAvailableModels } from '@/lib/stripe/config';
import type { Database } from '@/lib/supabase/database.types';

type SubscriptionTier = Database['public']['Enums']['subscription_tier'];

export function useSubscription() {
  const { userDetails } = useAuth();
  
  const tier = userDetails?.subscription_tier || 'free';
  const tierDetails = getSubscriptionTier(tier);
  
  const canUseFeature = (feature: string): boolean => {
    const features = tierDetails.features as any;
    return features[feature] === true;
  };
  
  const getRemainingCredits = (): number => {
    const usedCredits = userDetails?.usage_count || 0;
    const monthlyCredits = tierDetails.features.monthlyCredits;
    return Math.max(0, monthlyCredits - usedCredits);
  };
  
  const hasCredits = (): boolean => {
    return getRemainingCredits() > 0;
  };
  
  const getMaxFileSize = (): number => {
    return tierDetails.features.maxFileSizeMb;
  };
  
  const getBatchLimit = (): number => {
    return tierDetails.features.batchSize;
  };
  
  const getAvailableAIModels = (): string[] => {
    return getAvailableModels(tier);
  };
  
  const canAccessAPI = (): boolean => {
    return tierDetails.features.apiAccess;
  };
  
  const getSupportLevel = (): string => {
    return tierDetails.features.support;
  };
  
  const isFreeTier = (): boolean => {
    return tier === 'free';
  };
  
  const isPaidTier = (): boolean => {
    return tier !== 'free';
  };
  
  const canUpgrade = (): boolean => {
    return tier !== 'premium';
  };

  return {
    tier,
    tierDetails,
    canUseFeature,
    getRemainingCredits,
    hasCredits,
    getMaxFileSize,
    getBatchLimit,
    getAvailableAIModels,
    canAccessAPI,
    getSupportLevel,
    isFreeTier,
    isPaidTier,
    canUpgrade,
  };
}