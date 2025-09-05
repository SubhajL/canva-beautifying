'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { createClientUsageTracker } from '@/lib/usage/tracking-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Zap, X } from 'lucide-react';
import Link from 'next/link';

interface NotificationState {
  show: boolean;
  type: 'warning' | 'critical' | 'exceeded';
  message: string;
  percentage: number;
}

export function UsageNotification() {
  const { user } = useAuth();
  const { canUpgrade } = useSubscription();
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Disable in test mode
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '7071') {
      return;
    }
    
    if (user) {
      checkUsageStatus();
      // Check every 5 minutes
      const interval = setInterval(checkUsageStatus, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const checkUsageStatus = async () => {
    if (!user) return;

    try {
      const tracker = createClientUsageTracker();
      const usage = await tracker.checkUsageLimit(user.id);
      
      const notificationKey = `${user.id}-${new Date().getMonth()}-${new Date().getFullYear()}`;
      
      if (usage.percentageUsed >= 100) {
        // Usage exceeded
        if (!dismissed.has(`${notificationKey}-exceeded`)) {
          setNotification({
            show: true,
            type: 'exceeded',
            message: 'You have reached your monthly credit limit',
            percentage: 100,
          });
        }
      } else if (usage.percentageUsed >= 90) {
        // Critical - 90% used
        if (!dismissed.has(`${notificationKey}-critical`)) {
          setNotification({
            show: true,
            type: 'critical',
            message: `You have used ${Math.round(usage.percentageUsed)}% of your monthly credits`,
            percentage: usage.percentageUsed,
          });
        }
      } else if (usage.percentageUsed >= 80) {
        // Warning - 80% used
        if (!dismissed.has(`${notificationKey}-warning`)) {
          setNotification({
            show: true,
            type: 'warning',
            message: `You have used ${Math.round(usage.percentageUsed)}% of your monthly credits`,
            percentage: usage.percentageUsed,
          });
        }
      } else {
        // Clear notification if usage drops below threshold
        setNotification(null);
      }
    } catch (error) {
      console.error('Failed to check usage status:', error);
    }
  };

  const handleDismiss = () => {
    if (notification && user) {
      const notificationKey = `${user.id}-${new Date().getMonth()}-${new Date().getFullYear()}-${notification.type}`;
      setDismissed(prev => new Set(prev).add(notificationKey));
      setNotification(null);
    }
  };

  if (!notification || !notification.show) {
    return null;
  }

  const variants = {
    warning: 'border-amber-200 bg-amber-50 dark:bg-amber-950/20',
    critical: 'border-orange-200 bg-orange-50 dark:bg-orange-950/20',
    exceeded: 'border-red-200 bg-red-50 dark:bg-red-950/20',
  };

  const icons = {
    warning: <AlertCircle className="h-4 w-4 text-amber-600" />,
    critical: <Zap className="h-4 w-4 text-orange-600" />,
    exceeded: <Zap className="h-4 w-4 text-red-600" />,
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-md z-50">
      <Alert className={`${variants[notification.type]} animate-in slide-in-from-bottom`}>
        <div className="flex items-start gap-3">
          {icons[notification.type]}
          <div className="flex-1 space-y-2">
            <AlertDescription className="font-medium">
              {notification.message}
            </AlertDescription>
            {canUpgrade() && (
              <div className="flex gap-2">
                <Link href="/app/settings/billing">
                  <Button size="sm" variant="default">
                    Upgrade Plan
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                >
                  Dismiss
                </Button>
              </div>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Alert>
    </div>
  );
}