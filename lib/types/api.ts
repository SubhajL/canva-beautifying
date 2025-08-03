/**
 * API-related type definitions
 */

import { NextRequest } from 'next/server'
import { User } from '@supabase/supabase-js'

// Request context types
export interface AuthenticatedRequest extends NextRequest {
  user?: User
}

export interface RequestContext {
  params: Record<string, string>
  searchParams?: URLSearchParams
}

// Common request/response types
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
}

export interface SortParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FilterParams {
  [key: string]: string | number | boolean | undefined
}

// Error response types
export interface ApiError {
  error: string
  code?: string
  statusCode?: number
  details?: Record<string, unknown>
}

// Success response types  
export interface ApiSuccessResponse<T = unknown> {
  data: T
  message?: string
  metadata?: {
    page?: number
    limit?: number
    total?: number
    hasMore?: boolean
  }
}

// Webhook types
export interface WebhookPayload {
  event: string
  data: Record<string, unknown>
  timestamp: string
  signature?: string
}

// File upload types
export interface FileUploadResponse {
  url: string
  key: string
  size: number
  type: string
}

// Export types for route handlers
export type RouteHandler<_T = unknown> = (
  request: Request,
  context: RequestContext
) => Promise<Response>

export type AuthenticatedRouteHandler<_T = unknown> = (
  request: AuthenticatedRequest,
  context: RequestContext
) => Promise<Response>