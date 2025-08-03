import { createClient } from '@/lib/supabase/client';
import { useState, useEffect } from 'react';

export interface FeatureFlagMetadata {
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  tags?: string[];
  dependencies?: string[];
  [key: string]: string | string[] | undefined;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  enabledForBeta: boolean;
  rolloutPercentage?: number;
  userOverrides?: Record<string, boolean>;
  metadata?: FeatureFlagMetadata;
}

export const FEATURE_FLAGS = {
  // Beta features
  BETA_ACCESS: 'beta_access',
  BETA_FEEDBACK_WIDGET: 'beta_feedback_widget',
  BETA_ANALYTICS: 'beta_analytics',
  BETA_PRIORITY_SUPPORT: 'beta_priority_support',
  
  // Feature rollouts
  BATCH_PROCESSING: 'batch_processing',
  ADVANCED_AI_MODELS: 'advanced_ai_models',
  REAL_TIME_COLLABORATION: 'real_time_collaboration',
  CUSTOM_TEMPLATES: 'custom_templates',
  API_ACCESS: 'api_access',
  
  // Limits
  ENHANCED_UPLOAD_LIMIT: 'enhanced_upload_limit',
  PRIORITY_QUEUE: 'priority_queue',
} as const;

export type FeatureFlagKey = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS];

// Default feature flag configuration
const defaultFlags: Record<FeatureFlagKey, Omit<FeatureFlag, 'key'>> = {
  [FEATURE_FLAGS.BETA_ACCESS]: {
    name: 'Beta Program Access',
    description: 'Access to beta program features',
    enabled: true,
    enabledForBeta: true,
  },
  [FEATURE_FLAGS.BETA_FEEDBACK_WIDGET]: {
    name: 'Beta Feedback Widget',
    description: 'In-app feedback collection for beta users',
    enabled: true,
    enabledForBeta: true,
  },
  [FEATURE_FLAGS.BETA_ANALYTICS]: {
    name: 'Beta Analytics Dashboard',
    description: 'Detailed analytics for beta users',
    enabled: true,
    enabledForBeta: true,
  },
  [FEATURE_FLAGS.BETA_PRIORITY_SUPPORT]: {
    name: 'Beta Priority Support',
    description: 'Priority support queue for beta users',
    enabled: true,
    enabledForBeta: true,
  },
  [FEATURE_FLAGS.BATCH_PROCESSING]: {
    name: 'Batch Processing',
    description: 'Process multiple documents at once',
    enabled: false,
    enabledForBeta: true,
    rolloutPercentage: 100, // 100% for beta users
  },
  [FEATURE_FLAGS.ADVANCED_AI_MODELS]: {
    name: 'Advanced AI Models',
    description: 'Access to premium AI models',
    enabled: false,
    enabledForBeta: true,
  },
  [FEATURE_FLAGS.REAL_TIME_COLLABORATION]: {
    name: 'Real-time Collaboration',
    description: 'Collaborate on documents in real-time',
    enabled: false,
    enabledForBeta: false,
  },
  [FEATURE_FLAGS.CUSTOM_TEMPLATES]: {
    name: 'Custom Templates',
    description: 'Create and use custom document templates',
    enabled: false,
    enabledForBeta: true,
  },
  [FEATURE_FLAGS.API_ACCESS]: {
    name: 'API Access',
    description: 'Programmatic access to enhancement API',
    enabled: false,
    enabledForBeta: false,
  },
  [FEATURE_FLAGS.ENHANCED_UPLOAD_LIMIT]: {
    name: 'Enhanced Upload Limits',
    description: 'Increased file size and count limits',
    enabled: false,
    enabledForBeta: true,
  },
  [FEATURE_FLAGS.PRIORITY_QUEUE]: {
    name: 'Priority Queue Access',
    description: 'Skip the queue for faster processing',
    enabled: false,
    enabledForBeta: true,
  },
};

export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private flags: Map<string, FeatureFlag> = new Map();
  private userCache: Map<string, { isBeta: boolean; flags: Record<string, boolean> }> = new Map();

  private constructor() {
    this.initializeFlags();
  }

  static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  private initializeFlags() {
    for (const [key, config] of Object.entries(defaultFlags)) {
      this.flags.set(key, { key, ...config });
    }
  }

  async isFeatureEnabled(
    flagKey: FeatureFlagKey,
    userId?: string
  ): Promise<boolean> {
    const flag = this.flags.get(flagKey);
    if (!flag) return false;

    // Check if globally enabled
    if (!flag.enabled && !flag.enabledForBeta) return false;

    // No user context, return global state
    if (!userId) return flag.enabled;

    // Check user-specific override
    if (flag.userOverrides?.[userId] !== undefined) {
      return flag.userOverrides[userId];
    }

    // Check if user is beta and feature is enabled for beta
    const userInfo = await this.getUserInfo(userId);
    if (userInfo.isBeta && flag.enabledForBeta) {
      return true;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined) {
      const hash = this.hashUserId(userId);
      const percentage = (hash % 100) + 1;
      return percentage <= flag.rolloutPercentage;
    }

    return flag.enabled;
  }

  async getUserFeatures(userId: string): Promise<Record<string, boolean>> {
    const features: Record<string, boolean> = {};
    
    for (const key of Object.values(FEATURE_FLAGS)) {
      features[key] = await this.isFeatureEnabled(key, userId);
    }
    
    return features;
  }

  async getUserInfo(userId: string): Promise<{ isBeta: boolean; flags: Record<string, boolean> }> {
    // Check cache first
    const cached = this.userCache.get(userId);
    if (cached) return cached;

    try {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_beta_user, feature_flags')
        .eq('id', userId)
        .single();

      const userInfo = {
        isBeta: profile?.is_beta_user || false,
        flags: profile?.feature_flags || {},
      };

      // Cache for 5 minutes
      this.userCache.set(userId, userInfo);
      setTimeout(() => this.userCache.delete(userId), 5 * 60 * 1000);

      return userInfo;
    } catch (error) {
      console.error('Failed to get user info for feature flags:', error);
      return { isBeta: false, flags: {} };
    }
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Admin methods
  async updateFeatureFlag(
    flagKey: FeatureFlagKey,
    updates: Partial<FeatureFlag>
  ): Promise<void> {
    const flag = this.flags.get(flagKey);
    if (!flag) throw new Error(`Feature flag ${flagKey} not found`);

    this.flags.set(flagKey, { ...flag, ...updates });
    
    // Clear user cache to force refresh
    this.userCache.clear();
  }

  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }
}

// Singleton instance
export const featureFlags = FeatureFlagService.getInstance();

// React hook for feature flags
export function useFeatureFlag(flagKey: FeatureFlagKey, userId?: string): {
  enabled: boolean;
  loading: boolean;
} {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    featureFlags.isFeatureEnabled(flagKey, userId)
      .then(setEnabled)
      .finally(() => setLoading(false));
  }, [flagKey, userId]);

  return { enabled, loading };
}

// HOC for feature-gated components
export function withFeatureFlag<P extends object>(
  Component: React.ComponentType<P>,
  flagKey: FeatureFlagKey,
  FallbackComponent?: React.ComponentType
) {
  return function FeatureFlaggedComponent(props: P & { userId?: string }) {
    const { enabled, loading } = useFeatureFlag(flagKey, props.userId);

    if (loading) return null;
    if (!enabled) return FallbackComponent ? <FallbackComponent /> : null;

    return <Component {...props} />;
  };
}