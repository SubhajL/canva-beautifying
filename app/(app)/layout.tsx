'use client';

import { AppHeader } from '@/components/layout/app-header'
import { UsageNotification } from '@/components/usage/usage-notification'
import { UpsellPrompt } from '@/components/usage/upsell-prompt'
import { SkipNavigation, Landmark } from '@/components/a11y/skip-navigation'
import { LiveRegionProvider } from '@/components/a11y/live-region'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { BetaFeedbackWidget } from '@/components/beta/beta-feedback-widget'
import { useAuth } from '@/contexts/auth'
import { useFeatureFlag } from '@/lib/features/feature-flags'
import { useBetaTracking } from '@/lib/tracking/beta-usage-tracker'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth();
  const { enabled: showFeedbackWidget } = useFeatureFlag('beta_feedback_widget', user?.id);
  
  // Enable beta usage tracking for beta users
  useBetaTracking();

  return (
    <LiveRegionProvider>
      <div className="min-h-screen bg-gray-50">
        <SkipNavigation />
        
        <Landmark
          id="main-navigation"
          as="header"
          role="banner"
          label="Main navigation"
        >
          <AppHeader />
        </Landmark>
        
        <Landmark
          id="main-content"
          as="main"
          role="main"
          label="Main content"
          className="container mx-auto px-4 py-8 pb-20 md:pb-8"
        >
          {children}
        </Landmark>
        
        <MobileBottomNav />
        <UsageNotification />
        <UpsellPrompt />
        
        {/* Beta Feedback Widget */}
        {user && showFeedbackWidget && (
          <BetaFeedbackWidget 
            userId={user.id}
            position="bottom-right"
          />
        )}
      </div>
    </LiveRegionProvider>
  )
}