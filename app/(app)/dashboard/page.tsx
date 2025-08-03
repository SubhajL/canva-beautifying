'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { UsageStats } from '@/components/dashboard/usage-stats';
import { RecentEnhancements } from '@/components/dashboard/recent-enhancements';
import { EnhancementHistory } from '@/components/dashboard/enhancement-history';
import { QuickActions } from '@/components/dashboard/quick-actions';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* Dashboard Header */}
      <DashboardHeader />

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Dashboard Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Usage Statistics - Takes 1 column */}
        <div className="lg:col-span-1">
          <UsageStats />
        </div>

        {/* Recent Enhancements - Takes 2 columns */}
        <div className="lg:col-span-2">
          <RecentEnhancements />
        </div>
      </div>

      {/* Enhancement History - Full width */}
      <EnhancementHistory />
    </div>
  );
}