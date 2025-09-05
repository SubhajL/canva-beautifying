/**
 * Client-safe event tracking for browser and Edge Runtime environments
 */

import { logger } from './logger'

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

  // Log the event in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Telemetry event', {
      event: name,
      ...properties,
    })
  }

  // Send to analytics if available
  if (typeof window !== 'undefined' && window.analytics?.track) {
    window.analytics.track(name, {
      ...properties,
      timestamp: event.timestamp.toISOString(),
    })
  }

  // Also send to any custom telemetry endpoint if configured
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT) {
    sendTelemetryToEndpoint(event).catch(error => {
      logger.warn('Failed to send telemetry event', { error: error.message })
    })
  }
}

export function trackEvent(
  category: string,
  action: string,
  label?: string,
  value?: number
): void {
  const eventName = `${category}_${action}`
  const properties: Record<string, any> = {
    category,
    action,
  }

  if (label) properties.label = label
  if (value !== undefined) properties.value = value

  createTelemetryEvent(eventName, properties)
}

// Performance tracking
export function trackPerformance(
  metric: string,
  value: number,
  unit: string = 'ms',
  metadata?: Record<string, any>
): void {
  createTelemetryEvent('performance_metric', {
    metric,
    value,
    unit,
    ...metadata,
  })
}

// Error tracking
export function trackError(
  error: Error,
  context?: Record<string, any>
): void {
  createTelemetryEvent('error_occurred', {
    error_name: error.name,
    error_message: error.message,
    error_stack: error.stack,
    ...context,
  })
}

// User interaction tracking
export function trackInteraction(
  element: string,
  action: 'click' | 'hover' | 'focus' | 'blur',
  metadata?: Record<string, any>
): void {
  createTelemetryEvent('user_interaction', {
    element,
    action,
    ...metadata,
  })
}

// Page view tracking
export function trackPageView(
  pathname: string,
  referrer?: string,
  metadata?: Record<string, any>
): void {
  createTelemetryEvent('page_view', {
    pathname,
    referrer: referrer || document.referrer,
    title: document.title,
    ...metadata,
  })
}

// Feature usage tracking
export function trackFeatureUsage(
  feature: string,
  action: string,
  metadata?: Record<string, any>
): void {
  createTelemetryEvent('feature_usage', {
    feature,
    action,
    ...metadata,
  })
}

// API call tracking
export function trackApiCall(
  endpoint: string,
  method: string,
  status: number,
  duration: number,
  metadata?: Record<string, any>
): void {
  createTelemetryEvent('api_call', {
    endpoint,
    method,
    status,
    duration,
    success: status >= 200 && status < 300,
    ...metadata,
  })
}

// Helper to send telemetry to custom endpoint
async function sendTelemetryToEndpoint(event: TelemetryEvent): Promise<void> {
  const endpoint = process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT
  if (!endpoint) return

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...event,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: event.timestamp?.toISOString(),
      }),
    })
  } catch (error) {
    // Silently fail - we don't want telemetry failures to affect the app
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to send telemetry:', error)
    }
  }
}

// Auto-track page views if enabled
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_AUTO_TRACK_PAGE_VIEWS === 'true') {
  // Track initial page view
  window.addEventListener('load', () => {
    trackPageView(window.location.pathname)
  })

  // Track route changes (for SPAs)
  let lastPathname = window.location.pathname
  const observer = new MutationObserver(() => {
    if (window.location.pathname !== lastPathname) {
      lastPathname = window.location.pathname
      trackPageView(lastPathname)
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

// Type declarations for global analytics
declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties?: Record<string, any>) => void
    }
  }
}