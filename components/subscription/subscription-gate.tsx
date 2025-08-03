'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import Link from 'next/link';

interface SubscriptionGateProps {
  children: ReactNode;
  requiredTier?: 'basic' | 'pro' | 'premium';
  feature?: string;
  fallback?: ReactNode;
}

export function SubscriptionGate({ 
  children, 
  requiredTier, 
  feature,
  fallback 
}: SubscriptionGateProps) {
  const { tier, canUseFeature } = useSubscription();

  const hasAccess = () => {
    if (feature) {
      return canUseFeature(feature);
    }
    
    if (requiredTier) {
      const tierOrder = ['free', 'basic', 'pro', 'premium'];
      const currentTierIndex = tierOrder.indexOf(tier);
      const requiredTierIndex = tierOrder.indexOf(requiredTier);
      return currentTierIndex >= requiredTierIndex;
    }
    
    return true;
  };

  if (hasAccess()) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          <CardTitle>Upgrade Required</CardTitle>
        </div>
        <CardDescription>
          This feature requires a {requiredTier || 'paid'} subscription
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/app/settings/billing">
          <Button className="w-full">
            View Plans
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}