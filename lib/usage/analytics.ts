import { createClient } from '@/lib/supabase/server';
import { getNextResetDate } from './billing-cycle';

interface UsagePattern {
  averageDailyUsage: number;
  peakUsageDays: string[];
  usageByDayOfWeek: Record<string, number>;
  usageByHour: Record<number, number>;
  growthRate: number; // Month-over-month growth percentage
}

interface UsageForecast {
  projectedMonthlyUsage: number;
  projectedEndDate: Date | null; // When credits will run out
  recommendedTier: string;
  confidence: number; // 0-1 confidence score
  basedOnDays: number; // Number of days of data
}

export class UsageAnalytics {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabase: ReturnType<typeof createClient>) {
    this.supabase = supabase;
  }

  /**
   * Analyze usage patterns for a user
   */
  async analyzeUsagePatterns(userId: string): Promise<UsagePattern> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get usage data for the last 60 days
    const { data: usageData, error } = await this.supabase
      .from('usage_tracking')
      .select('credits_used, created_at')
      .eq('user_id', userId)
      .gte('created_at', sixtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error || !usageData || usageData.length === 0) {
      return this.getDefaultPattern();
    }

    // Separate current and previous month data
    const currentMonthData = usageData.filter(
      d => new Date(d.created_at) >= thirtyDaysAgo
    );
    const previousMonthData = usageData.filter(
      d => new Date(d.created_at) < thirtyDaysAgo
    );

    // Calculate daily usage
    const dailyUsage = new Map<string, number>();
    const hourlyUsage = new Map<number, number>();
    const dayOfWeekUsage = new Map<string, number>();

    currentMonthData.forEach(record => {
      const date = new Date(record.created_at);
      const dateKey = date.toISOString().split('T')[0];
      const hour = date.getHours();
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
      const credits = record.credits_used || 1;

      dailyUsage.set(dateKey, (dailyUsage.get(dateKey) || 0) + credits);
      hourlyUsage.set(hour, (hourlyUsage.get(hour) || 0) + credits);
      dayOfWeekUsage.set(dayOfWeek, (dayOfWeekUsage.get(dayOfWeek) || 0) + credits);
    });

    // Calculate average daily usage
    const totalDays = Math.max(dailyUsage.size, 1);
    const totalUsage = Array.from(dailyUsage.values()).reduce((sum, val) => sum + val, 0);
    const averageDailyUsage = totalUsage / totalDays;

    // Find peak usage days
    const sortedDays = Array.from(dailyUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([date]) => date);

    // Calculate growth rate
    const currentTotal = currentMonthData.reduce((sum, r) => sum + (r.credits_used || 1), 0);
    const previousTotal = previousMonthData.reduce((sum, r) => sum + (r.credits_used || 1), 0);
    const growthRate = previousTotal > 0 
      ? ((currentTotal - previousTotal) / previousTotal) * 100 
      : 0;

    return {
      averageDailyUsage,
      peakUsageDays: sortedDays,
      usageByDayOfWeek: Object.fromEntries(dayOfWeekUsage),
      usageByHour: Object.fromEntries(hourlyUsage),
      growthRate,
    };
  }

  /**
   * Forecast future usage based on historical patterns
   */
  async forecastUsage(userId: string): Promise<UsageForecast> {
    const patterns = await this.analyzeUsagePatterns(userId);
    
    // Get user's current usage and limits
    const { data: user } = await this.supabase
      .from('users')
      .select('usage_count, subscription_tier')
      .eq('id', userId)
      .single();

    if (!user) {
      return this.getDefaultForecast();
    }

    // Get subscription limits
    const { data: limits } = await this.supabase
      .from('subscription_limits')
      .select('monthly_credits')
      .eq('tier', user.subscription_tier)
      .single();

    if (!limits) {
      return this.getDefaultForecast();
    }

    const currentUsage = user.usage_count || 0;
    const monthlyLimit = limits.monthly_credits;
    const remainingCredits = monthlyLimit - currentUsage;
    
    // Get days until reset
    const nextReset = await getNextResetDate(userId);
    const daysUntilReset = nextReset 
      ? Math.ceil((nextReset.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : 30;

    // Calculate projected usage
    const projectedRemainingUsage = patterns.averageDailyUsage * daysUntilReset;
    const projectedMonthlyUsage = currentUsage + projectedRemainingUsage;

    // Calculate when credits will run out
    let projectedEndDate: Date | null = null;
    if (patterns.averageDailyUsage > 0 && remainingCredits > 0) {
      const daysUntilEmpty = remainingCredits / patterns.averageDailyUsage;
      if (daysUntilEmpty < daysUntilReset) {
        projectedEndDate = new Date(Date.now() + daysUntilEmpty * 24 * 60 * 60 * 1000);
      }
    }

    // Recommend tier based on projected usage
    const recommendedTier = this.recommendTier(projectedMonthlyUsage);

    // Calculate confidence based on data availability
    const basedOnDays = patterns.peakUsageDays.length;
    const confidence = Math.min(basedOnDays / 30, 1); // More days = higher confidence

    return {
      projectedMonthlyUsage: Math.round(projectedMonthlyUsage),
      projectedEndDate,
      recommendedTier,
      confidence,
      basedOnDays,
    };
  }

  /**
   * Get anomaly detection for unusual usage patterns
   */
  async detectAnomalies(userId: string): Promise<{
    hasAnomaly: boolean;
    type?: 'spike' | 'unusual_time' | 'rapid_depletion';
    description?: string;
  }> {
    const patterns = await this.analyzeUsagePatterns(userId);
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's usage
    const { data: todayUsage } = await this.supabase
      .from('usage_tracking')
      .select('credits_used, created_at')
      .eq('user_id', userId)
      .gte('created_at', today)
      .lt('created_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    if (!todayUsage) {
      return { hasAnomaly: false };
    }

    const todayTotal = todayUsage.reduce((sum, r) => sum + (r.credits_used || 1), 0);

    // Check for usage spike (3x average)
    if (todayTotal > patterns.averageDailyUsage * 3) {
      return {
        hasAnomaly: true,
        type: 'spike',
        description: `Today's usage (${todayTotal}) is significantly higher than your average (${patterns.averageDailyUsage.toFixed(1)})`,
      };
    }

    // Check for unusual time usage (e.g., middle of night)
    const unusualHours = todayUsage.filter(r => {
      const hour = new Date(r.created_at).getHours();
      return hour >= 2 && hour <= 5; // 2 AM - 5 AM
    });

    if (unusualHours.length > 0) {
      return {
        hasAnomaly: true,
        type: 'unusual_time',
        description: 'Unusual activity detected during overnight hours',
      };
    }

    // Check for rapid depletion (used 50% of monthly in < 5 days)
    const { data: user } = await this.supabase
      .from('users')
      .select('usage_count')
      .eq('id', userId)
      .single();

    if (user) {
      const dayOfMonth = new Date().getDate();
      const usagePercentage = (user.usage_count / patterns.averageDailyUsage) * 100;
      
      if (dayOfMonth <= 5 && usagePercentage >= 50) {
        return {
          hasAnomaly: true,
          type: 'rapid_depletion',
          description: 'You\'ve used over 50% of your monthly credits in the first few days',
        };
      }
    }

    return { hasAnomaly: false };
  }

  /**
   * Recommend a subscription tier based on usage
   */
  private recommendTier(monthlyUsage: number): string {
    if (monthlyUsage <= 10) return 'free';
    if (monthlyUsage <= 100) return 'basic';
    if (monthlyUsage <= 500) return 'pro';
    return 'premium';
  }

  /**
   * Get default pattern when no data available
   */
  private getDefaultPattern(): UsagePattern {
    return {
      averageDailyUsage: 0,
      peakUsageDays: [],
      usageByDayOfWeek: {},
      usageByHour: {},
      growthRate: 0,
    };
  }

  /**
   * Get default forecast when no data available
   */
  private getDefaultForecast(): UsageForecast {
    return {
      projectedMonthlyUsage: 0,
      projectedEndDate: null,
      recommendedTier: 'free',
      confidence: 0,
      basedOnDays: 0,
    };
  }
}

/**
 * Create usage analytics instance
 */
export async function createUsageAnalytics() {
  const supabase = await createClient();
  return new UsageAnalytics(supabase);
}