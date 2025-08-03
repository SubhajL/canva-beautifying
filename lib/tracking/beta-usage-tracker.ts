import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export interface UsageEventMetadata {
  userAgent?: string;
  screenResolution?: string;
  viewport?: string;
  language?: string;
  pageTitle?: string;
  referrer?: string;
  duration?: number;
  pageViews?: number;
  events?: number;
  // Allow additional properties of specific types
  [key: string]: string | number | boolean | undefined;
}

export interface UsageEvent {
  userId: string;
  eventType: string;
  eventCategory: string;
  eventAction?: string;
  eventLabel?: string;
  eventValue?: number;
  pageUrl?: string;
  sessionId?: string;
  metadata?: UsageEventMetadata;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  startTime: Date;
  lastActivity: Date;
  pageViews: number;
  events: number;
}

class BetaUsageTracker {
  private static instance: BetaUsageTracker;
  private sessions: Map<string, SessionData> = new Map();
  private eventQueue: UsageEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 10000; // 10 seconds
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.startFlushInterval();
    
    // Listen for page visibility changes
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
      
      // Flush on page unload
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  static getInstance(): BetaUsageTracker {
    if (!BetaUsageTracker.instance) {
      BetaUsageTracker.instance = new BetaUsageTracker();
    }
    return BetaUsageTracker.instance;
  }

  // Get or create session for user
  private getSession(userId: string): SessionData {
    const existingSession = this.sessions.get(userId);
    
    if (existingSession) {
      const sessionAge = Date.now() - existingSession.lastActivity.getTime();
      
      // If session is still active, update last activity
      if (sessionAge < this.SESSION_TIMEOUT_MS) {
        existingSession.lastActivity = new Date();
        return existingSession;
      }
    }
    
    // Create new session
    const newSession: SessionData = {
      sessionId: uuidv4(),
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      pageViews: 0,
      events: 0,
    };
    
    this.sessions.set(userId, newSession);
    
    // Track session start
    this.trackEvent({
      userId,
      eventType: 'session_start',
      eventCategory: 'session',
      sessionId: newSession.sessionId,
      metadata: {
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
      },
    });
    
    return newSession;
  }

  // Track a usage event
  trackEvent(event: UsageEvent): void {
    // Ensure we have a session
    const session = this.getSession(event.userId);
    event.sessionId = event.sessionId || session.sessionId;
    
    // Update session metrics
    session.events++;
    if (event.eventType === 'page_view') {
      session.pageViews++;
    }
    
    // Add to queue
    this.eventQueue.push({
      ...event,
      pageUrl: event.pageUrl || window.location.href,
    });
    
    // Flush if queue is full
    if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  // Track page view
  trackPageView(userId: string, pagePath: string, pageTitle?: string): void {
    this.trackEvent({
      userId,
      eventType: 'page_view',
      eventCategory: 'navigation',
      eventAction: 'view',
      eventLabel: pagePath,
      metadata: {
        pageTitle,
        referrer: document.referrer,
      },
    });
  }

  // Track feature usage
  trackFeatureUsage(
    userId: string,
    featureName: string,
    action: string,
    metadata?: UsageEventMetadata
  ): void {
    this.trackEvent({
      userId,
      eventType: 'feature_usage',
      eventCategory: 'feature',
      eventAction: action,
      eventLabel: featureName,
      metadata,
    });
  }

  // Track enhancement process
  trackEnhancement(
    userId: string,
    documentId: string,
    stage: 'start' | 'upload' | 'analyze' | 'enhance' | 'complete' | 'error',
    metadata?: UsageEventMetadata
  ): void {
    this.trackEvent({
      userId,
      eventType: 'enhancement_process',
      eventCategory: 'enhancement',
      eventAction: stage,
      eventLabel: documentId,
      metadata,
    });
  }

  // Track performance metrics
  trackPerformance(
    userId: string,
    metric: string,
    value: number,
    metadata?: UsageEventMetadata
  ): void {
    this.trackEvent({
      userId,
      eventType: 'performance_metric',
      eventCategory: 'performance',
      eventAction: metric,
      eventValue: value,
      metadata,
    });
  }

  // Track errors
  trackError(
    userId: string,
    errorType: string,
    errorMessage: string,
    metadata?: UsageEventMetadata
  ): void {
    this.trackEvent({
      userId,
      eventType: 'error',
      eventCategory: 'error',
      eventAction: errorType,
      eventLabel: errorMessage,
      metadata,
    });
  }

  // Flush events to database
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;
    
    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      const supabase = createClient();
      
      // Batch insert events
      const { error } = await supabase
        .from('beta_analytics')
        .insert(
          eventsToFlush.map(event => ({
            user_id: event.userId,
            event_type: event.eventType,
            event_category: event.eventCategory,
            event_action: event.eventAction,
            event_label: event.eventLabel,
            event_value: event.eventValue,
            page_url: event.pageUrl,
            session_id: event.sessionId,
            user_agent: navigator.userAgent,
            metadata: event.metadata || {},
            created_at: new Date().toISOString(),
          }))
        );
      
      if (error) {
        console.error('Failed to flush beta analytics:', error);
        // Put events back in queue for retry
        this.eventQueue.unshift(...eventsToFlush);
      }
    } catch (error) {
      console.error('Error flushing beta analytics:', error);
      // Put events back in queue for retry
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  // Start periodic flush
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
      this.cleanupSessions();
    }, this.FLUSH_INTERVAL_MS);
  }

  // Clean up old sessions
  private cleanupSessions(): void {
    const now = Date.now();
    
    for (const [userId, session] of this.sessions.entries()) {
      const sessionAge = now - session.lastActivity.getTime();
      
      if (sessionAge > this.SESSION_TIMEOUT_MS) {
        // Track session end
        this.trackEvent({
          userId,
          eventType: 'session_end',
          eventCategory: 'session',
          sessionId: session.sessionId,
          metadata: {
            duration: now - session.startTime.getTime(),
            pageViews: session.pageViews,
            events: session.events,
          },
        });
        
        this.sessions.delete(userId);
      }
    }
  }

  // Stop tracking (cleanup)
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    this.flush();
    
    // End all sessions
    for (const [userId, session] of this.sessions.entries()) {
      this.trackEvent({
        userId,
        eventType: 'session_end',
        eventCategory: 'session',
        sessionId: session.sessionId,
        metadata: {
          duration: Date.now() - session.startTime.getTime(),
          pageViews: session.pageViews,
          events: session.events,
        },
      });
    }
    
    this.sessions.clear();
  }
}

// Export singleton instance
export const betaUsageTracker = BetaUsageTracker.getInstance();

// React hook for beta usage tracking
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth';

export function useBetaTracking() {
  const { user } = useAuth();
  const pathname = usePathname();
  
  // Track page views
  useEffect(() => {
    if (!user) return;
    
    // Check if user is beta
    const checkAndTrack = async () => {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_beta_user')
        .eq('id', user.id)
        .single();
      
      if (profile?.is_beta_user) {
        betaUsageTracker.trackPageView(
          user.id,
          pathname,
          document.title
        );
      }
    };
    
    checkAndTrack();
  }, [pathname, user]);
  
  // Return tracking functions
  return {
    trackFeature: (featureName: string, action: string, metadata?: UsageEventMetadata) => {
      if (user) {
        betaUsageTracker.trackFeatureUsage(user.id, featureName, action, metadata);
      }
    },
    trackEnhancement: (
      documentId: string,
      stage: 'start' | 'upload' | 'analyze' | 'enhance' | 'complete' | 'error',
      metadata?: UsageEventMetadata
    ) => {
      if (user) {
        betaUsageTracker.trackEnhancement(user.id, documentId, stage, metadata);
      }
    },
    trackPerformance: (metric: string, value: number, metadata?: UsageEventMetadata) => {
      if (user) {
        betaUsageTracker.trackPerformance(user.id, metric, value, metadata);
      }
    },
    trackError: (errorType: string, errorMessage: string, metadata?: UsageEventMetadata) => {
      if (user) {
        betaUsageTracker.trackError(user.id, errorType, errorMessage, metadata);
      }
    },
  };
}