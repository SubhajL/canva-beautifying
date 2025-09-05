// This module is for server-side use only
if (typeof window !== 'undefined') {
  throw new Error(
    'Server-only module: @/lib/observability cannot be imported in client-side code. ' +
    'Use @/lib/observability/client instead.'
  );
}

// Logger exports
export {
  logger,
  createLogger,
  requestContext,
  type Logger,
  type LogContext,
  type HttpLogEntry,
  type DatabaseLogEntry,
  type AILogEntry,
  type QueueLogEntry,
  type WebSocketLogEntry,
  type StorageLogEntry,
  type SecurityLogEntry,
  type PerformanceLogEntry,
} from './logger';

// Middleware exports
export {
  withLogging,
  withApiLogging,
  getCurrentContext,
} from './middleware';

// AI monitoring exports
export {
  monitorAIOperation,
  logModelSelection,
  logAIRateLimit,
  createMonitoredAIClient,
  type AIOperationOptions,
  type AIOperationResult,
} from './ai-monitoring';

// Metrics exports
export {
  metrics,
  register,
  recordHttpMetrics,
  recordSystemMetrics,
  getMetricsResponse,
  getMetricsJson,
} from './metrics';

// Tracing exports
export {
  initializeTracing,
  shutdownTracing,
  getTracer,
  createSpan,
  traceAsync,
  addSpanEvent,
  setSpanAttributes,
  getCurrentTraceId,
  getCurrentSpanId,
} from './tracing';

// Instrumentation exports
export {
  registerInstrumentations,
  instrumentDatabase,
  instrumentAIProviders,
  instrumentBullMQ,
} from './instrumentation';

// Performance monitoring exports
export {
  initializePerformanceMonitor,
  getPerformanceMonitor,
  type PerformanceMetric,
  type PerformanceThreshold,
  type AggregatedMetric,
  PerformanceMonitor,
} from './performance-monitor';

// Performance analyzer exports  
export {
  initializePerformanceAnalyzer,
  getPerformanceAnalyzer,
  type ResourceUsage,
  type PerformanceBottleneck,
  PerformanceAnalyzer,
} from './performance-analyzer';

// AI performance tracker exports
export {
  initializeAIPerformanceTracker,
  getAIPerformanceTracker,
  type AIModelPerformance,
  type AIModelStats,
  type ModelSelectionCriteria,
  type ModelRecommendation,
  AIPerformanceTracker,
} from './ai-performance-tracker';

// Alerting exports
export {
  initializeAlertManager,
  getAlertManager,
  type Alert,
  type AlertRule,
  type AlertAction,
  AlertManager,
} from './alerting';

// Log shipper exports
export {
  getLogShipper,
  LogShipper,
} from './log-shipper';

// Resource tracker exports
export {
  initializeResourceTracker,
  getResourceTracker,
  ResourceTracker,
  type SystemMetrics,
  type DiskIOMetrics,
  type NetworkMetrics,
} from './resource-tracker';

// SLI/SLO tracker exports
export {
  initializeSLISLOTracker,
  getSLISLOTracker,
  SLISLOTracker,
  type SLI,
  type SLO,
  type SLOStatus,
  type SLIQuery,
  type QueryDefinition,
} from './sli-slo-tracker';

// Trace alerting exports
export {
  initializeTraceAlerting,
  getTraceAlertingEngine,
  TraceAlertingEngine,
  type AlertRule as TraceAlertRule,
  type AlertCondition,
  type AlertAction as TraceAlertAction,
  type Alert as TraceAlert,
} from './trace-alerting';