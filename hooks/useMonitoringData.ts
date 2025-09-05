import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDashboardClient } from '@/lib/monitoring/dashboard-client';
import type { DashboardData } from '@/types/monitoring';

export function useMonitoringData() {
  const client = getDashboardClient();

  return useQuery<DashboardData>({
    queryKey: ['monitoring', 'dashboard'],
    queryFn: () => client.fetchDashboardData(),
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

export function useAlertAcknowledge() {
  const client = getDashboardClient();
  const queryClient = useQueryClient();

  return async (alertId: string) => {
    try {
      await client.acknowledgeAlert(alertId);
      // Invalidate monitoring data to refresh alerts
      await queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  };
}