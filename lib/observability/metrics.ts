// This module is for server-side use only
if (typeof window !== 'undefined') {
  throw new Error(
    'Server-only module: @/lib/observability/metrics cannot be imported in client-side code. ' +
    'Use @/lib/observability/client instead.'
  );
}

import { Registry, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { logger } from './logger';

// Create a custom registry
export const register = new Registry();

// Add default labels
register.setDefaultLabels({
  app: 'beautifyai',
  environment: process.env.NODE_ENV || 'development',
});

// HTTP metrics
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register],
});

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// AI Operation metrics
const aiOperationsTotal = new Counter({
  name: 'ai_operations_total',
  help: 'Total number of AI operations',
  labelNames: ['operation', 'model', 'provider'],
  registers: [register],
});

const aiOperationDuration = new Histogram({
  name: 'ai_operation_duration_seconds',
  help: 'Duration of AI operations in seconds',
  labelNames: ['operation', 'model', 'provider'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

const aiTokensUsed = new Counter({
  name: 'ai_tokens_used_total',
  help: 'Total number of tokens used in AI operations',
  labelNames: ['operation', 'model', 'provider'],
  registers: [register],
});

const aiOperationCost = new Counter({
  name: 'ai_operation_cost_dollars',
  help: 'Total cost of AI operations in dollars',
  labelNames: ['operation', 'model', 'provider'],
  registers: [register],
});

const aiOperationsErrors = new Counter({
  name: 'ai_operations_errors_total',
  help: 'Total number of AI operation errors',
  labelNames: ['operation', 'model', 'provider', 'error_type'],
  registers: [register],
});

const aiModelFallbacks = new Counter({
  name: 'ai_model_fallbacks_total',
  help: 'Number of times AI model fallback was used',
  labelNames: ['from_model', 'to_model', 'reason'],
  registers: [register],
});

const aiRateLimitUtilization = new Gauge({
  name: 'ai_rate_limit_utilization_percent',
  help: 'Current AI rate limit utilization percentage',
  labelNames: ['model', 'provider'],
  registers: [register],
});

// Queue metrics
const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue jobs in seconds',
  labelNames: ['queue'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

const queueDepth = new Gauge({
  name: 'queue_depth',
  help: 'Current number of jobs in queue',
  labelNames: ['queue', 'status'],
  registers: [register],
});

const queueWorkerUtilization = new Gauge({
  name: 'queue_worker_utilization_percent',
  help: 'Queue worker CPU utilization percentage',
  labelNames: ['worker_id'],
  registers: [register],
});

// Storage metrics
const storageOperationsTotal = new Counter({
  name: 'storage_operations_total',
  help: 'Total number of storage operations',
  labelNames: ['operation', 'bucket'],
  registers: [register],
});

const storageOperationDuration = new Histogram({
  name: 'storage_operation_duration_seconds',
  help: 'Duration of storage operations in seconds',
  labelNames: ['operation', 'bucket'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const storageBandwidth = new Counter({
  name: 'storage_bandwidth_bytes',
  help: 'Total bytes transferred in storage operations',
  labelNames: ['operation', 'bucket'],
  registers: [register],
});

// WebSocket metrics
const websocketConnectionsActive = new Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

const websocketMessagesTotal = new Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['direction', 'event_type'],
  registers: [register],
});

const websocketRoomsActive = new Gauge({
  name: 'websocket_rooms_active',
  help: 'Number of active WebSocket rooms',
  registers: [register],
});

// Database metrics
const databaseConnectionsActive = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  labelNames: ['pool'],
  registers: [register],
});

const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// System metrics
const systemMemoryUsage = new Gauge({
  name: 'system_memory_usage_bytes',
  help: 'System memory usage in bytes',
  labelNames: ['type'],
  registers: [register],
});

const systemCpuUsage = new Gauge({
  name: 'system_cpu_usage_percent',
  help: 'System CPU usage percentage',
  registers: [register],
});

// Enhancement pipeline metrics
const enhancementPipelineStagesDuration = new Histogram({
  name: 'enhancement_pipeline_stage_duration_seconds',
  help: 'Duration of enhancement pipeline stages',
  labelNames: ['stage'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

const enhancementPipelineTotal = new Counter({
  name: 'enhancement_pipeline_total',
  help: 'Total number of enhancement pipelines',
  labelNames: ['status'],
  registers: [register],
});

// Export all metrics
export const metrics = {
  // HTTP
  httpRequestDuration,
  httpRequestsTotal,
  
  // AI
  aiOperationsTotal,
  aiOperationDuration,
  aiTokensUsed,
  aiOperationCost,
  aiOperationsErrors,
  aiModelFallbacks,
  aiRateLimitUtilization,
  
  // Queue
  queueJobsTotal,
  queueJobDuration,
  queueDepth,
  queueWorkerUtilization,
  
  // Storage
  storageOperationsTotal,
  storageOperationDuration,
  storageBandwidth,
  
  // WebSocket
  websocketConnectionsActive,
  websocketMessagesTotal,
  websocketRoomsActive,
  
  // Database
  databaseConnectionsActive,
  databaseQueryDuration,
  
  // System
  systemMemoryUsage,
  systemCpuUsage,
  
  // Enhancement
  enhancementPipelineStagesDuration,
  enhancementPipelineTotal,
};

// Helper to record HTTP metrics
export function recordHttpMetrics(
  method: string,
  route: string,
  statusCode: number,
  duration: number
) {
  const labels = { method, route, status_code: statusCode.toString() };
  
  httpRequestsTotal.inc(labels);
  httpRequestDuration.observe(labels, duration / 1000);
  
  // Also log as performance metric
  logger.logPerformanceMetric(
    'http.request.duration',
    duration,
    'ms',
    labels
  );
}

// Helper to record system metrics
export function recordSystemMetrics() {
  const memUsage = process.memoryUsage();
  
  systemMemoryUsage.set({ type: 'rss' }, memUsage.rss);
  systemMemoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
  systemMemoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
  systemMemoryUsage.set({ type: 'external' }, memUsage.external);
  
  // CPU usage (simplified - in production you'd want more sophisticated tracking)
  if (process.cpuUsage) {
    const cpuUsage = process.cpuUsage();
    const totalCpu = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    systemCpuUsage.set(totalCpu);
  }
}

// Start recording system metrics periodically
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    try {
      recordSystemMetrics();
    } catch (error) {
      logger.error({ err: error }, 'Failed to record system metrics');
    }
  }, 10000); // Every 10 seconds
}

// Helper to get metrics endpoint response
export async function getMetricsResponse(): Promise<string> {
  return register.metrics();
}

// Helper to get metrics as JSON
export async function getMetricsJson() {
  return register.getMetricsAsJSON();
}