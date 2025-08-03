import { z } from 'zod'

// Enhancement request schemas
export const enhanceRequestSchema = z.object({
  documentType: z.enum(['worksheet', 'presentation', 'marketing', 'infographic', 'other']).optional(),
  enhancementSettings: z.object({
    colorPalette: z.enum(['vibrant', 'pastel', 'monochrome', 'professional', 'auto']).optional(),
    style: z.enum(['modern', 'playful', 'elegant', 'minimalist', 'auto']).optional(),
    targetAudience: z.enum(['children', 'teenagers', 'adults', 'professionals', 'general']).optional(),
    preserveContent: z.boolean().default(true),
    enhancementLevel: z.enum(['subtle', 'moderate', 'dramatic']).default('moderate'),
  }).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type EnhanceRequest = z.infer<typeof enhanceRequestSchema>

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const historyQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export type HistoryQuery = z.infer<typeof historyQuerySchema>

// Response schemas
export const enhancementStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  progress: z.number().min(0).max(100),
  currentStage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  result: z.object({
    enhancedFileUrl: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    improvements: z.object({
      before: z.number(),
      after: z.number(),
    }),
    enhancementsApplied: z.array(z.string()),
    processingTime: z.number(),
  }).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type EnhancementStatus = z.infer<typeof enhancementStatusSchema>

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File).refine((file) => {
    const maxSize = 50 * 1024 * 1024 // 50MB
    return file.size <= maxSize
  }, 'File size must be less than 50MB').refine((file) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ]
    return allowedTypes.includes(file.type)
  }, 'Invalid file type. Supported: PDF, PNG, JPG, WEBP, PPT, PPTX'),
})

// API key validation for service-to-service auth
export const apiKeySchema = z.object({
  apiKey: z.string().min(32),
  apiSecret: z.string().min(32),
})

// Webhook payload schema
export const webhookPayloadSchema = z.object({
  event: z.enum(['enhancement.started', 'enhancement.progress', 'enhancement.completed', 'enhancement.failed']),
  timestamp: z.string().datetime(),
  data: z.object({
    enhancementId: z.string(),
    status: z.string(),
    progress: z.number().optional(),
    result: z.any().optional(),
    error: z.any().optional(),
  }),
})

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>

// Validation helper
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error }
    }
    throw error
  }
}

// Format validation errors for API response
export function formatValidationErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {}
  
  error.errors.forEach((err) => {
    const path = err.path.join('.')
    if (!formatted[path]) {
      formatted[path] = []
    }
    formatted[path].push(err.message)
  })
  
  return formatted
}