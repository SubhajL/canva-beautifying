'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/hooks/use-subscription';
import { useUsageTracking } from '@/hooks/use-usage-tracking';
import { 
  Zap, 
  TrendingUp, 
  FileText, 
  Clock,
  AlertCircle
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UsageChart } from './usage-chart';

export function UsageStats() {
  const { 
    tier, 
    getRemainingCredits,
    tierDetails 
  } = useSubscription();
  const _loading = false; // No loading state in useSubscription hook
  
  const { 
    stats, 
    loading: statsLoading 
  } = useUsageTracking();

  const remainingCredits = getRemainingCredits();
  const usagePercentage = stats?.currentMonthUsage 
    ? (stats.currentMonthUsage / tierDetails.features.monthlyCredits) * 100
    : 0;
  const daysUntilReset = stats?.daysUntilReset || 0;
  const isLowCredits = remainingCredits < (tierDetails.features.monthlyCredits * 0.2);

  if (statsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>Your monthly usage overview</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      label: 'Credits Used',
      value: `${stats?.currentMonthUsage || 0} / ${tierDetails.features.monthlyCredits}`,
      icon: Zap,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: 'Documents Enhanced',
      value: stats?.documentsProcessed || 0,
      icon: FileText,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      label: 'Avg. Processing Time',
      value: stats?.averageProcessingTime || '0s',
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>
            {tier.charAt(0).toUpperCase() + tier.slice(1)} Plan • Resets in {daysUntilReset} days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
        {/* Credits Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Monthly Credits</span>
            <span className="text-muted-foreground">
              {remainingCredits} remaining
            </span>
          </div>
          <Progress value={usagePercentage} className="h-3" />
          {isLowCredits && (
            <Alert className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You&apos;re running low on credits. 
                <Link href="/settings/billing" className="font-medium underline ml-1">
                  Upgrade your plan
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Stats Grid */}
        <div className="space-y-3">
          {statItems.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="font-semibold">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Usage Trend */}
        {stats?.usageTrend && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className={`h-4 w-4 ${
                stats.usageTrend > 0 ? 'text-green-500' : 'text-red-500'
              }`} />
              <span>
                {Math.abs(stats.usageTrend)}% {stats.usageTrend > 0 ? 'increase' : 'decrease'} from last month
              </span>
            </div>
          </div>
        )}

        {/* Upgrade CTA */}
        {tier === 'free' && (
          <div className="pt-4 border-t">
            <Link href="/settings/billing">
              <Button className="w-full" variant="outline">
                Upgrade for More Credits
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
    
    {/* Usage Chart */}
    <UsageChart />
  </div>
  );
}