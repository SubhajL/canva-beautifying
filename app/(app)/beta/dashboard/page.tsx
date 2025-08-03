'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { BetaHeader } from '@/components/beta/beta-header';
import { BetaStats } from '@/components/beta/beta-stats';
import { BetaFeatures } from '@/components/beta/beta-features';
import { FeedbackHistory } from '@/components/beta/feedback-history';
import { BetaAnnouncements } from '@/components/beta/beta-announcements';
import { BetaRank } from '@/components/beta/beta-rank';
import { QuickFeedback } from '@/components/beta/quick-feedback';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export default function BetaDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isBetaUser, setIsBetaUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const checkBetaStatus = async () => {
      if (!user) return;
      
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('user_profiles')
          .select('is_beta_user, beta_joined_at')
          .eq('id', user.id)
          .single();
        
        if (!error && data) {
          if (data.is_beta_user) {
            setIsBetaUser(true);
          } else {
            // Redirect non-beta users
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('Error checking beta status:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkBetaStatus();
    }
  }, [user, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading beta dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user || !isBetaUser) {
    return null;
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* Beta Dashboard Header */}
      <BetaHeader />

      {/* Beta Program Benefits & Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Beta Stats - 2 columns */}
        <div className="lg:col-span-2">
          <BetaStats userId={user.id} />
        </div>

        {/* Beta Rank - 1 column */}
        <div className="lg:col-span-1">
          <BetaRank userId={user.id} />
        </div>
      </div>

      {/* Quick Feedback Section */}
      <QuickFeedback userId={user.id} />

      {/* Beta Features & Announcements */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Beta Features Access */}
        <BetaFeatures userId={user.id} />

        {/* Beta Announcements */}
        <BetaAnnouncements />
      </div>

      {/* Feedback History - Full width */}
      <FeedbackHistory userId={user.id} />
    </div>
  );
}