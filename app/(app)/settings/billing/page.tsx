'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X } from 'lucide-react';
import { SUBSCRIPTION_TIERS } from '@/lib/stripe/config';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

type SubscriptionDetails = {
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  trial_end: number | null;
  items: {
    data: Array<{
      price: {
        id: string;
        unit_amount: number;
        currency: string;
      };
    }>;
  };
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userDetails, refreshUserDetails } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({
        title: 'Success!',
        description: 'Your subscription has been updated.',
      });
      refreshUserDetails();
    } else if (searchParams.get('canceled') === 'true') {
      toast({
        title: 'Canceled',
        description: 'Subscription update was canceled.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast, refreshUserDetails]);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/subscription');
      const data = await response.json();
      if (data.subscription) {
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  };

  const handleSubscribe = async (tier: typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS]) => {
    if (tier.priceId === null) return;
    
    setLoadingTier(tier.id);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: tier.priceId,
          tier: tier.id,
        }),
      });

      const data = await response.json();
      if (data.url) {
        router.push(data.url);
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to start checkout process',
        variant: 'destructive',
      });
    } finally {
      setLoadingTier(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const data = await response.json();
      if (data.url) {
        router.push(data.url);
      } else {
        throw new Error('Failed to create portal session');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to open billing portal',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      if (response.ok) {
        toast({
          title: 'Subscription canceled',
          description: 'Your subscription will remain active until the end of the billing period.',
        });
        fetchSubscription();
        refreshUserDetails();
      } else {
        throw new Error('Failed to cancel subscription');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      });

      if (response.ok) {
        toast({
          title: 'Subscription reactivated',
          description: 'Your subscription has been reactivated.',
        });
        fetchSubscription();
        refreshUserDetails();
      } else {
        throw new Error('Failed to reactivate subscription');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to reactivate subscription',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const currentTier = userDetails?.subscription_tier || 'free';
  const currentTierDetails = SUBSCRIPTION_TIERS[currentTier.toUpperCase() as keyof typeof SUBSCRIPTION_TIERS];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            Your subscription details and usage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-2xl font-bold">{currentTierDetails.name}</p>
            </div>
            <Badge variant={userDetails?.subscription_status === 'active' ? 'default' : 'secondary'}>
              {userDetails?.subscription_status || 'Free'}
            </Badge>
          </div>

          {subscription && (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Billing Period</p>
                <p className="font-medium">
                  {subscription.cancel_at_period_end
                    ? `Cancels on ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}`
                    : `Renews on ${new Date(subscription.current_period_end * 1000).toLocaleDateString()}`}
                </p>
              </div>

              {subscription.trial_end && subscription.trial_end > Date.now() / 1000 && (
                <div>
                  <p className="text-sm text-muted-foreground">Trial Period</p>
                  <p className="font-medium">
                    Ends on {new Date(subscription.trial_end * 1000).toLocaleDateString()}
                  </p>
                </div>
              )}
            </>
          )}

          <div>
            <p className="text-sm text-muted-foreground">Monthly Credits</p>
            <p className="font-medium">
              {userDetails?.usage_count || 0} / {currentTierDetails.features.monthlyCredits}
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          {currentTier !== 'free' && (
            <>
              <Button
                onClick={handleManageSubscription}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Manage Subscription
              </Button>
              
              {subscription?.cancel_at_period_end ? (
                <Button
                  variant="outline"
                  onClick={handleReactivateSubscription}
                  disabled={loading}
                >
                  Reactivate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleCancelSubscription}
                  disabled={loading}
                >
                  Cancel Subscription
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>

      <div>
        <h2 className="text-2xl font-bold mb-4">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Object.values(SUBSCRIPTION_TIERS).map((tier) => (
            <Card key={tier.id} className={currentTier === tier.id ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                <CardDescription>
                  {tier.price === 0 ? 'Free forever' : `$${tier.price}/month`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    {tier.features.monthlyCredits} credits/month
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    {tier.features.maxFileSizeMb}MB max file size
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Batch size: {tier.features.batchSize}
                  </li>
                  <li className="flex items-center">
                    {tier.features.apiAccess ? (
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 mr-2 text-gray-400" />
                    )}
                    API access
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    {tier.features.support} support
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                {currentTier === tier.id ? (
                  <Button disabled className="w-full">
                    Current Plan
                  </Button>
                ) : tier.price === 0 ? (
                  <Button variant="outline" disabled className="w-full">
                    Free Plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSubscribe(tier)}
                    disabled={loadingTier === tier.id}
                    className="w-full"
                  >
                    {loadingTier === tier.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {currentTier === 'free' ? 'Subscribe' : 'Switch Plan'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}