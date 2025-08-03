import { Database } from '@/lib/supabase/database.types';

export type UsageAction = 'enhancement' | 'batch_enhancement' | 'api_call' | 'export';

export interface UsageMetadata {
  documentType?: string;
  modelUsed?: string;
  processingTime?: number;
  fileSize?: number;
  // Allow additional properties of specific types
  [key: string]: string | number | boolean | undefined;
}

export interface UsageTrackingOptions {
  userId: string;
  action: UsageAction;
  enhancementId?: string;
  credits?: number;
  metadata?: UsageMetadata;
}

export interface UsageLimit {
  tier: Database['public']['Enums']['subscription_tier'];
  monthlyCredits: number;
  remainingCredits: number;
  usedCredits: number;
  percentageUsed: number;
  canProceed: boolean;
}

export interface UsageStats {
  currentMonth: {
    total: number;
    byAction: Record<UsageAction, number>;
    dailyUsage: Array<{ date: string; count: number }>;
  };
  lastMonth: {
    total: number;
  };
  allTime: {
    total: number;
  };
}

import { SupabaseClient } from '@supabase/supabase-js';

export class UsageTracker {
  protected supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  /**
   * Track usage for a specific action
   */
  async trackUsage(options: UsageTrackingOptions): Promise<void> {
    const { userId, action, enhancementId, credits = 1, metadata } = options;

    try {
      // Call the database function to increment usage
      const { error } = await this.supabase.rpc('increment_usage', {
        p_user_id: userId,
        p_enhancement_id: enhancementId || null,
        p_action: action,
        p_credits: credits,
      });

      if (error) {
        console.error('Failed to track usage:', error);
        throw new Error('Failed to track usage');
      }

      // Log additional metadata for analytics
      if (metadata) {
        await this.logUsageMetadata(userId, action, metadata);
      }
    } catch (error) {
      console.error('Usage tracking error:', error);
      // Don't throw - we don't want to block the user action if tracking fails
    }
  }

  /**
   * Check if user has available credits
   */
  async checkUsageLimit(userId: string): Promise<UsageLimit> {
    try {
      // Get user details with subscription info
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('subscription_tier, usage_count')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('Failed to get user details');
      }

      // Get subscription limits
      const { data: limits, error: limitsError } = await this.supabase
        .from('subscription_limits')
        .select('monthly_credits')
        .eq('tier', user.subscription_tier)
        .single();

      if (limitsError || !limits) {
        throw new Error('Failed to get subscription limits');
      }

      const usedCredits = user.usage_count || 0;
      const monthlyCredits = limits.monthly_credits;
      const remainingCredits = Math.max(0, monthlyCredits - usedCredits);
      const percentageUsed = (usedCredits / monthlyCredits) * 100;

      // Check using the database function
      const { data: canProceed, error: checkError } = await this.supabase.rpc(
        'check_usage_limit',
        { p_user_id: userId }
      );

      if (checkError) {
        console.error('Failed to check usage limit:', checkError);
      }

      return {
        tier: user.subscription_tier,
        monthlyCredits,
        remainingCredits,
        usedCredits,
        percentageUsed,
        canProceed: canProceed ?? false,
      };
    } catch (error) {
      console.error('Usage limit check error:', error);
      // Return a default response that blocks the action
      return {
        tier: 'free',
        monthlyCredits: 10,
        remainingCredits: 0,
        usedCredits: 10,
        percentageUsed: 100,
        canProceed: false,
      };
    }
  }

  /**
   * Get detailed usage statistics
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Get current month usage
      const { data: currentMonthData, error: currentError } = await this.supabase
        .from('usage_tracking')
        .select('action, credits_used, created_at')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
        .order('created_at', { ascending: true });

      if (currentError) {
        throw new Error('Failed to get current month usage');
      }

      // Get last month usage
      const { data: lastMonthData, error: lastError } = await this.supabase
        .from('usage_tracking')
        .select('credits_used')
        .eq('user_id', userId)
        .gte('created_at', startOfLastMonth.toISOString())
        .lte('created_at', endOfLastMonth.toISOString());

      if (lastError) {
        throw new Error('Failed to get last month usage');
      }

      // Get all-time usage
      const { data: allTimeData, error: allTimeError } = await this.supabase
        .from('usage_tracking')
        .select('credits_used')
        .eq('user_id', userId);

      if (allTimeError) {
        throw new Error('Failed to get all-time usage');
      }

      // Process current month data
      const byAction: Record<UsageAction, number> = {
        enhancement: 0,
        batch_enhancement: 0,
        api_call: 0,
        export: 0,
      };

      const dailyUsageMap = new Map<string, number>();

      let currentMonthTotal = 0;
      currentMonthData?.forEach((item) => {
        const credits = item.credits_used || 1;
        currentMonthTotal += credits;

        if (item.action && item.action in byAction) {
          byAction[item.action as UsageAction] += credits;
        }

        const date = new Date(item.created_at).toISOString().split('T')[0];
        dailyUsageMap.set(date, (dailyUsageMap.get(date) || 0) + credits);
      });

      // Convert daily usage map to array
      const dailyUsage = Array.from(dailyUsageMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate totals
      const lastMonthTotal = lastMonthData?.reduce((sum, item) => sum + (item.credits_used || 1), 0) || 0;
      const allTimeTotal = allTimeData?.reduce((sum, item) => sum + (item.credits_used || 1), 0) || 0;

      return {
        currentMonth: {
          total: currentMonthTotal,
          byAction,
          dailyUsage,
        },
        lastMonth: {
          total: lastMonthTotal,
        },
        allTime: {
          total: allTimeTotal,
        },
      };
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return {
        currentMonth: {
          total: 0,
          byAction: {
            enhancement: 0,
            batch_enhancement: 0,
            api_call: 0,
            export: 0,
          },
          dailyUsage: [],
        },
        lastMonth: {
          total: 0,
        },
        allTime: {
          total: 0,
        },
      };
    }
  }

  /**
   * Log usage metadata for analytics
   */
  private async logUsageMetadata(
    userId: string,
    action: string,
    metadata: UsageMetadata
  ): Promise<void> {
    // This could be sent to an analytics service like Mixpanel, Amplitude, etc.
    // For now, we'll just log it
    console.log('Usage metadata:', {
      userId,
      action,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Check if user is approaching their limit
   */
  async isApproachingLimit(userId: string, threshold = 0.8): Promise<boolean> {
    const usage = await this.checkUsageLimit(userId);
    return usage.percentageUsed >= threshold * 100;
  }

  /**
   * Get credits required for an action
   */
  getCreditsForAction(action: UsageAction, count = 1): number {
    const creditMap: Record<UsageAction, number> = {
      enhancement: 1,
      batch_enhancement: 1, // Per document in batch
      api_call: 1,
      export: 0, // Exports don't consume credits
    };

    return creditMap[action] * count;
  }
}