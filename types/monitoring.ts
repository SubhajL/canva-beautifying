export interface DashboardData {
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime: number;
      error?: string;
    }>;
  };
  performance: {
    cpu: number;
    memory: number;
    eventLoopLag: number;
    trends: Record<string, {
      trend: 'increasing' | 'decreasing' | 'stable';
      changePercent: number;
      prediction?: {
        willExceedThreshold: boolean;
        estimatedTime?: string;
        threshold: number;
      };
    }>;
  };
  ai: {
    totalRequests: number;
    successRate: number;
    avgLatency: number;
    topModels: Array<{
      model: string;
      provider: string;
      requests: number;
      successRate: number;
      avgLatency: number;
      totalCost: number;
    }>;
  };
  queues: {
    total: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  alerts: Array<{
    id?: string;
    level: 'warning' | 'critical' | 'info';
    type: string;
    title?: string;
    message: string;
    timestamp: string;
  }>;
  metrics: {
    http: {
      requestsPerMinute: number;
      avgResponseTime: number;
      errorRate: number;
    };
    storage: {
      operations: number;
      avgDuration: number;
      bandwidth: number;
    };
  };
}

export interface TimeRange {
  label: string;
  value: '5m' | '1h' | '24h';
  seconds: number;
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface MetricCard {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  color?: 'success' | 'warning' | 'danger' | 'default';
}