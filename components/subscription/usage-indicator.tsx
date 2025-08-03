'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertCircle, Zap } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import Link from 'next/link';

export function UsageIndicator() {
  const { 
    tierDetails, 
    getRemainingCredits, 
    hasCredits,
    canUpgrade,
  } = useSubscription();

  const remainingCredits = getRemainingCredits();
  const totalCredits = tierDetails.features.monthlyCredits;
  const usagePercentage = ((totalCredits - remainingCredits) / totalCredits) * 100;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">Monthly Credits</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {remainingCredits} / {totalCredits}
            </span>
          </div>
          
          <Progress value={usagePercentage} className="h-2" />
          
          {!hasCredits() && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">You&apos;ve used all your monthly credits</span>
            </div>
          )}
          
          {canUpgrade() && remainingCredits < 5 && (
            <Link href="/app/settings/billing">
              <Button variant="outline" size="sm" className="w-full">
                Upgrade for more credits
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}