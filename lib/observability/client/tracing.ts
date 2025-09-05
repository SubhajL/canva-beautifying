/**
 * Client-safe tracing for browser and Edge Runtime environments
 * Provides mock implementations of tracing functions without Node.js dependencies
 */

import { logger } from './logger'

export interface ClientSpan {
  spanId: string
  traceId: string
  name: string
  startTime: number
  attributes: Record<string, any>
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, any> }>
  status: { code: 'OK' | 'ERROR'; message?: string }
  ended: boolean

  setAttributes(attributes: Record<string, any>): void
  setAttribute(key: string, value: any): void
  addEvent(name: string, attributes?: Record<string, any>): void
  setStatus(status: { code: 'OK' | 'ERROR'; message?: string }): void
  recordException(error: Error): void
  end(): void
  spanContext(): { traceId: string; spanId: string; traceFlags: number }
}

class MockSpan implements ClientSpan {
  spanId: string
  traceId: string
  name: string
  startTime: number
  attributes: Record<string, any> = {}
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, any> }> = []
  status: { code: 'OK' | 'ERROR'; message?: string } = { code: 'OK' }
  ended: boolean = false

  constructor(name: string, traceId: string) {
    this.name = name
    this.spanId = generateId()
    this.traceId = traceId
    this.startTime = performance.now()
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Span started: ${name}`, { spanId: this.spanId, traceId: this.traceId })
    }
  }

  setAttributes(attributes: Record<string, any>): void {
    Object.assign(this.attributes, attributes)
  }

  setAttribute(key: string, value: any): void {
    this.attributes[key] = value
  }

  addEvent(name: string, attributes?: Record<string, any>): void {
    this.events.push({
      name,
      timestamp: performance.now(),
      attributes
    })
  }

  setStatus(status: { code: 'OK' | 'ERROR'; message?: string }): void {
    this.status = status
  }

  recordException(error: Error): void {
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack
    })
    this.setStatus({ code: 'ERROR', message: error.message })
  }

  end(): void {
    if (this.ended) return
    
    this.ended = true
    const duration = performance.now() - this.startTime
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Span ended: ${this.name}`, {
        spanId: this.spanId,
        traceId: this.traceId,
        duration: Math.round(duration),
        status: this.status,
        attributes: this.attributes
      })
    }
  }

  spanContext() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      traceFlags: 1
    }
  }
}

// Store for active spans
const activeSpans = new Map<string, ClientSpan>()
let currentTraceId = generateTraceId()

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function generateTraceId(): string {
  // Generate a 32-character hex string for trace ID
  const hex = '0123456789abcdef'
  let traceId = ''
  for (let i = 0; i < 32; i++) {
    traceId += hex[Math.floor(Math.random() * 16)]
  }
  return traceId
}

export function createClientSpan(
  name: string,
  options?: {
    attributes?: Record<string, any>
  }
): ClientSpan {
  const span = new MockSpan(name, currentTraceId)
  
  if (options?.attributes) {
    span.setAttributes(options.attributes)
  }
  
  activeSpans.set(span.spanId, span)
  return span
}

export function createTelemetrySpan(
  name: string,
  options?: {
    attributes?: Record<string, any>
  }
): ClientSpan {
  return createClientSpan(name, options)
}

export function getCurrentTraceId(): string {
  return currentTraceId
}

export function getCurrentSpanId(): string | undefined {
  const spans = Array.from(activeSpans.values())
  const activeSpan = spans.find(span => !span.ended)
  return activeSpan?.spanId
}

export function getActiveSpan(): ClientSpan | undefined {
  const spans = Array.from(activeSpans.values())
  return spans.find(span => !span.ended)
}

export async function traceAsync<T>(
  name: string,
  fn: (span: ClientSpan) => Promise<T>,
  options?: {
    attributes?: Record<string, any>
  }
): Promise<T> {
  const span = createClientSpan(name, options)
  
  try {
    const result = await fn(span)
    span.setStatus({ code: 'OK' })
    return result
  } catch (error) {
    span.recordException(error as Error)
    throw error
  } finally {
    span.end()
    activeSpans.delete(span.spanId)
  }
}

// Helper functions for specific use cases
export function createEnhancementTrace(
  documentId: string,
  userId: string,
  enhancementSettings?: Record<string, any>
): { span: ClientSpan; traceId: string; spanId: string } {
  const span = createClientSpan('enhancement.pipeline', {
    attributes: {
      'enhancement.document_id': documentId,
      'enhancement.user_id': userId,
      'enhancement.settings': JSON.stringify(enhancementSettings || {}),
      'enhancement.start_time': new Date().toISOString(),
    },
  })

  return {
    span,
    traceId: span.traceId,
    spanId: span.spanId,
  }
}

export function recordPipelineEvent(
  eventName: string,
  attributes?: Record<string, any>
): void {
  const span = getActiveSpan()
  if (span) {
    span.addEvent(`enhancement.${eventName}`, {
      'event.timestamp': new Date().toISOString(),
      ...attributes,
    })
  }
}

// Initialize a new trace for each page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    currentTraceId = generateTraceId()
  })
}