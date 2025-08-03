'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, TrendingUp, Zap, Rocket } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { createClientUsageTracker } from '@/lib/usage/tracking-client';
import { SUBSCRIPTION_TIERS } from '@/lib/stripe/config';
import Link from 'next/link';

interface UpsellTrigger {
  condition: () => boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  cta: string;
  targetTier: 'basic' | 'pro' | 'premium';
}

export function UpsellPrompt() {
  const { user } = useAuth();
  const { tier, canUpgrade, getRemainingCredits, tierDetails } = useSubscription();
  const [showDialog, setShowDialog] = useState(false);
  const [currentTrigger, setCurrentTrigger] = useState<UpsellTrigger | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [usageStats, setUsageStats] = useState<any>(null);

  useEffect(() => {
    if (user && canUpgrade()) {
      loadUsageStats();
    }
  }, [user, canUpgrade]);

  useEffect(() => {
    if (usageStats && canUpgrade()) {
      checkUpsellTriggers();
    }
  }, [usageStats]);

  const loadUsageStats = async () => {
    if (!user) return;
    
    try {
      const tracker = createClientUsageTracker();
      const stats = await tracker.getUsageStats(user.id);
      setUsageStats(stats);
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    }
  };

  const upsellTriggers: UpsellTrigger[] = [
    {
      condition: () => getRemainingCredits() === 0,
      title: 'Out of Credits!',
      description: 'Upgrade now to continue enhancing your documents without interruption.',
      icon: <Zap className="h-8 w-8 text-amber-500" />,
      cta: 'Upgrade to Continue',
      targetTier: tier === 'free' ? 'basic' : tier === 'basic' ? 'pro' : 'premium',
    },
    {
      condition: () => {
        const remaining = getRemainingCredits();
        const total = tierDetails.features.monthlyCredits;
        return remaining <= 5 && remaining > 0 && total <= 100;
      },
      title: 'Running Low on Credits',
      description: 'You only have a few credits left. Upgrade for more monthly credits and better features.',
      icon: <TrendingUp className="h-8 w-8 text-blue-500" />,
      cta: 'See Upgrade Options',
      targetTier: tier === 'free' ? 'basic' : 'pro',
    },
    {
      condition: () => {
        if (!usageStats) return false;
        const dailyAvg = usageStats.currentMonth.total / new Date().getDate();
        const projectedMonthly = dailyAvg * 30;
        return projectedMonthly > tierDetails.features.monthlyCredits * 1.5;
      },
      title: 'Your Usage is Growing!',
      description: 'Based on your current usage pattern, you might benefit from a higher tier with more credits.',
      icon: <Rocket className="h-8 w-8 text-purple-500" />,
      cta: 'Explore Plans',
      targetTier: tier === 'free' ? 'basic' : tier === 'basic' ? 'pro' : 'premium',
    },
    {
      condition: () => {
        return tier === 'free' && usageStats?.currentMonth.total > 5;
      },
      title: 'Unlock Premium Features',
      description: 'Get access to advanced AI models, batch processing, and priority support.',
      icon: <Sparkles className="h-8 w-8 text-indigo-500" />,
      cta: 'Go Pro',
      targetTier: 'pro',
    },
  ];

  const checkUpsellTriggers = () => {
    // Don't show if user has dismissed all prompts today
    const today = new Date().toDateString();
    const allDismissedToday = dismissed.size >= upsellTriggers.length &&
      Array.from(dismissed).every(d => d.startsWith(today));
    
    if (allDismissedToday) return;

    // Find the first trigger that matches and hasn't been dismissed today
    const trigger = upsellTriggers.find(t => {
      const key = `${today}-${t.title}`;
      return !dismissed.has(key) && t.condition();
    });

    if (trigger) {
      setCurrentTrigger(trigger);
      setShowDialog(true);
    }
  };

  const handleDismiss = () => {
    if (currentTrigger) {
      const today = new Date().toDateString();
      const key = `${today}-${currentTrigger.title}`;
      setDismissed(prev => new Set(prev).add(key));
    }
    setShowDialog(false);
    setCurrentTrigger(null);
  };

  const getTargetTierDetails = () => {
    if (!currentTrigger) return null;
    return SUBSCRIPTION_TIERS[currentTrigger.targetTier.toUpperCase() as keyof typeof SUBSCRIPTION_TIERS];
  };

  if (!canUpgrade() || !currentTrigger) {
    return null;
  }

  const targetTier = getTargetTierDetails();

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {currentTrigger.icon}
            <DialogTitle className="text-xl">{currentTrigger.title}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {currentTrigger.description}
          </DialogDescription>
        </DialogHeader>

        {targetTier && (
          <Card className="mt-4">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">{targetTier.name} Plan</CardTitle>
              <CardDescription>
                ${targetTier.price}/month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm space-y-1">
                <p>✓ {targetTier.features.monthlyCredits} monthly credits</p>
                <p>✓ {targetTier.features.maxFileSizeMb}MB file size limit</p>
                <p>✓ Batch up to {targetTier.features.batchSize} files</p>
                {targetTier.features.apiAccess && <p>✓ API access included</p>}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 mt-4">
          <Link href="/app/settings/billing" className="flex-1">
            <Button className="w-full">
              {currentTrigger.cta}
            </Button>
          </Link>
          <Button variant="outline" onClick={handleDismiss}>
            Not Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InlineUpsellCard({ 
  show = true,
  className = '' 
}: { 
  show?: boolean;
  className?: string;
}) {
  const { tier, canUpgrade, getRemainingCredits } = useSubscription();
  
  if (!show || !canUpgrade() || getRemainingCredits() > 10) {
    return null;
  }

  const nextTier = tier === 'free' ? 'basic' : tier === 'basic' ? 'pro' : 'premium';
  const nextTierDetails = SUBSCRIPTION_TIERS[nextTier.toUpperCase() as keyof typeof SUBSCRIPTION_TIERS];

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Need More Credits?</CardTitle>
          </div>
        </div>
        <CardDescription>
          Upgrade to {nextTierDetails.name} for {nextTierDetails.features.monthlyCredits} monthly credits
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/app/settings/billing">
          <Button size="sm" className="w-full">
            Upgrade to {nextTierDetails.name} - ${nextTierDetails.price}/mo
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}