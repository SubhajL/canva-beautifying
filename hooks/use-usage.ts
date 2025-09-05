import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { useSubscription } from './use-subscription';

interface UsageData {
  used: number;
  limit: number;
  remainingCredits: number;
  percentageUsed: number;
  canEnhance: boolean;
  tier: string;
}

export function useUsage() {
  const { user, session } = useAuth();
  const { subscriptionTier } = useSubscription();
  const [usage, setUsage] = useState<UsageData>({
    used: 0,
    limit: 5,
    remainingCredits: 5,
    percentageUsed: 0,
    canEnhance: true,
    tier: 'free',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !session) {
      setLoading(false);
      return;
    }

    async function fetchUsage() {
      try {
        const response = await fetch('/api/v1/usage', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch usage data');
        }

        const data = await response.json();
        
        const remainingCredits = data.limit === -1 ? Infinity : data.limit - data.used;
        const percentageUsed = data.limit === -1 ? 0 : (data.used / data.limit) * 100;

        console.log('Usage API response:', data);
        console.log('Remaining credits:', remainingCredits);
        console.log('Can enhance:', remainingCredits > 0);

        setUsage({
          used: data.used || 0,
          limit: data.limit || 5,
          remainingCredits,
          percentageUsed,
          canEnhance: remainingCredits > 0,
          tier: data.tier || subscriptionTier || 'free',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Set default values on error
        setUsage({
          used: 0,
          limit: subscriptionTier === 'premium' ? -1 : subscriptionTier === 'pro' ? 50 : 5,
          remainingCredits: subscriptionTier === 'premium' ? Infinity : subscriptionTier === 'pro' ? 50 : 5,
          percentageUsed: 0,
          canEnhance: true,
          tier: subscriptionTier || 'free',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, [user, session, subscriptionTier]);

  const refreshUsage = async () => {
    if (!user || !session) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/v1/usage', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh usage data');
      }

      const data = await response.json();
      
      const remainingCredits = data.limit === -1 ? Infinity : data.limit - data.used;
      const percentageUsed = data.limit === -1 ? 0 : (data.used / data.limit) * 100;

      setUsage({
        used: data.used || 0,
        limit: data.limit || 5,
        remainingCredits,
        percentageUsed,
        canEnhance: remainingCredits > 0,
        tier: data.tier || subscriptionTier || 'free',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return {
    usage,
    loading,
    error,
    refreshUsage,
  };
}