/**
 * Common type definitions to replace 'any' types throughout the codebase
 */

// Generic object types
export type AnyObject = Record<string, unknown>
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export type JsonObject = { [key: string]: JsonValue }
export type JsonArray = JsonValue[]

// Common data structures
export interface TimestampedData {
  timestamp: string | Date
  value: number
}

export interface UserActivity {
  userId: string
  action: string
  timestamp: string | Date
  metadata?: Record<string, unknown>
}

export interface AnalyticsData {
  pageViews?: number
  uniqueUsers?: number
  avgSessionDuration?: number
  bounceRate?: number
  [key: string]: number | undefined
}

export interface ChartDataPoint {
  label: string
  value: number
  timestamp?: string | Date
}

// Error handling types
export interface ErrorDetails {
  message: string
  code?: string
  stack?: string
  context?: Record<string, unknown>
}

// API response types
export interface ApiResponse<T = unknown> {
  data?: T
  error?: ErrorDetails
  success: boolean
  message?: string
}

// Form and input types
export interface FormData {
  [key: string]: string | number | boolean | File | FormData | undefined
}

// Database record types
export interface DatabaseRecord {
  id: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

// Supabase specific types
export interface SupabaseError {
  message: string
  details?: string
  hint?: string
  code?: string
}

// Function types to replace Function
export type AnyFunction = (...args: unknown[]) => unknown
export type VoidFunction = () => void
export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>

// Event handler types
export type ClickHandler = (event: React.MouseEvent) => void
export type ChangeHandler<T = HTMLInputElement> = (event: React.ChangeEvent<T>) => void
export type SubmitHandler = (event: React.FormEvent) => void | Promise<void>

// Utility types
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type MaybePromise<T> = T | Promise<T>