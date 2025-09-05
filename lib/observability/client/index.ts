/**
 * Client-safe observability utilities for browser and Edge Runtime environments
 * 
 * These utilities do not depend on any Node.js-specific modules and can be safely
 * imported in client components, pages, and middleware.
 */

// Logger exports
export {
  ClientLogger,
  getClientLogger,
  logger,
  type LogLevel,
  type LogMetadata,
} from './logger'

// Tracing exports
export {
  createClientSpan,
  createTelemetrySpan,
  getCurrentTraceId,
  getCurrentSpanId,
  getActiveSpan,
  traceAsync,
  createEnhancementTrace,
  recordPipelineEvent,
  type ClientSpan,
} from './tracing'

// Events exports
export {
  createTelemetryEvent,
  trackEvent,
  trackPerformance,
  trackError,
  trackInteraction,
  trackPageView,
  trackFeatureUsage,
  trackApiCall,
  type TelemetryEvent,
} from './events'

// Error reporter exports
export {
  captureErrorBoundaryException,
  getUserErrorMessage,
  shouldIgnoreError,
  sanitizeErrorForLogging,
  createErrorId,
  type ErrorContext,
} from './error-reporter'

// Re-export commonly used functions at the top level for convenience
export { logger as default } from './logger'