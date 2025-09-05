// This module is for server-side use only
if (typeof window !== 'undefined') {
  throw new Error(
    'Server-only module: @/lib/observability/events cannot be imported in client-side code. ' +
    'Use @/lib/observability/client instead.'
  );
}

import { logger } from './logger'
import { metrics } from './metrics'

export interface TelemetryEvent {
  name: string
  properties?: Record<string, any>
  timestamp?: Date
}

export function createTelemetryEvent(
  name: string,
  properties?: Record<string, any>
): void {
  const event: TelemetryEvent = {
    name,
    properties,
    timestamp: new Date(),
  }

  // Log the event
  logger.info('Telemetry event', {
    event: name,
    ...properties,
  })

  // Record metric
  metrics.increment(`events.${name}`, 1, properties)

  // In production, you might also send to analytics service
  if (typeof window !== 'undefined' && window.analytics) {
    window.analytics.track(name, properties)
  }
}

declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties?: Record<string, any>) => void
    }
  }
}