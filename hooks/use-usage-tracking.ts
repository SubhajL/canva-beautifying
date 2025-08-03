import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { differenceInDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export interface UsageStats {
  currentMonthUsage: number;
  previousMonthUsage: number;
  documentsProcessed: number;
  averageProcessingTime: string;
  usageTrend: number; // percentage change from last month
  daysUntilReset: number;
  usageByDay: Array<{
    date: string;
    credits: number;
    documents: number;
  }>;
  topEnhancementTypes: Array<{
    type: string;
    count: number;
  }>;
}

interface UseUsageTrackingReturn {
  stats: UsageStats | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useUsageTracking(): UseUsageTrackingReturn {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const now = new Date();
      const startOfCurrentMonth = startOfMonth(now);
      const endOfCurrentMonth = endOfMonth(now);
      const startOfPreviousMonth = startOfMonth(subMonths(now, 1));
      const endOfPreviousMonth = endOfMonth(subMonths(now, 1));

      // Fetch current month usage
      const { data: currentMonthData, error: currentError } = await supabase
        .from('ai_usage_tracking')
        .select('credits_used, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startOfCurrentMonth.toISOString())
        .lte('created_at', endOfCurrentMonth.toISOString());

      if (currentError) throw currentError;

      // Fetch previous month usage
      const { data: previousMonthData, error: previousError } = await supabase
        .from('ai_usage_tracking')
        .select('credits_used')
        .eq('user_id', user.id)
        .gte('created_at', startOfPreviousMonth.toISOString())
        .lte('created_at', endOfPreviousMonth.toISOString());

      if (previousError) throw previousError;

      // Fetch documents data
      const { data: documentsData, error: docsError } = await supabase
        .from('documents')
        .select('created_at, status, enhancement_type, metadata')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', startOfCurrentMonth.toISOString());

      if (docsError) throw docsError;

      // Calculate stats
      const currentMonthUsage = currentMonthData?.reduce((sum, item) => 
        sum + (item.credits_used || 0), 0
      ) || 0;

      const previousMonthUsage = previousMonthData?.reduce((sum, item) => 
        sum + (item.credits_used || 0), 0
      ) || 0;

      const documentsProcessed = documentsData?.length || 0;

      // Calculate average processing time (mock for now)
      const averageProcessingTime = documentsProcessed > 0 ? '2.5s' : '0s';

      // Calculate usage trend
      const usageTrend = previousMonthUsage > 0
        ? Math.round(((currentMonthUsage - previousMonthUsage) / previousMonthUsage) * 100)
        : 0;

      // Days until reset
      const daysUntilReset = differenceInDays(endOfCurrentMonth, now) + 1;

      // Usage by day (last 7 days)
      const usageByDay = calculateUsageByDay(currentMonthData || [], documentsData || []);

      // Top enhancement types
      const topEnhancementTypes = calculateTopEnhancementTypes(documentsData || []);

      setStats({
        currentMonthUsage,
        previousMonthUsage,
        documentsProcessed,
        averageProcessingTime,
        usageTrend,
        daysUntilReset,
        usageByDay,
        topEnhancementTypes,
      });
    } catch (err) {
      console.error('Error fetching usage stats:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

function calculateUsageByDay(
  usageData: Array<{ credits_used: number; created_at: string }>,
  documentsData: Array<{ created_at: string }>
): UsageStats['usageByDay'] {
  const dayMap = new Map<string, { credits: number; documents: number }>();
  
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dayMap.set(dateStr, { credits: 0, documents: 0 });
  }

  // Aggregate usage data
  usageData.forEach(item => {
    const dateStr = item.created_at.split('T')[0];
    if (dayMap.has(dateStr)) {
      const current = dayMap.get(dateStr)!;
      current.credits += item.credits_used || 0;
    }
  });

  // Aggregate document data
  documentsData.forEach(doc => {
    const dateStr = doc.created_at.split('T')[0];
    if (dayMap.has(dateStr)) {
      const current = dayMap.get(dateStr)!;
      current.documents += 1;
    }
  });

  return Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    credits: data.credits,
    documents: data.documents,
  }));
}

function calculateTopEnhancementTypes(
  documentsData: Array<{ enhancement_type?: string }>
): UsageStats['topEnhancementTypes'] {
  const typeCount = new Map<string, number>();

  documentsData.forEach(doc => {
    const type = doc.enhancement_type || 'standard';
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  });

  return Array.from(typeCount.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}