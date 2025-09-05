import { NextRequest } from 'next/server'
import { validateSecureDownloadToken } from './secure-url'
import { apiErrors } from '../response'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export interface DownloadPermission {
  documentId: string
  userId: string
  canDownload: boolean
  reason?: string
}

/**
 * Validate download token from request
 */
export async function validateDownloadToken(
  request: NextRequest,
  expectedDocumentId?: string
): Promise<DownloadPermission> {
  // Extract token and signature from query parameters
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const signature = url.searchParams.get('sig')
  
  if (!token || !signature) {
    throw apiErrors.INVALID_TOKEN
  }
  
  // Validate token
  const tokenData = validateSecureDownloadToken(token, signature, expectedDocumentId)
  
  // Verify user has access to the document
  const supabase = await createClient()
  
  const { data: document, error } = await supabase
    .from('documents')
    .select('id, user_id, status')
    .eq('id', tokenData.documentId)
    .eq('user_id', tokenData.userId)
    .single()
  
  if (error || !document) {
    return {
      documentId: tokenData.documentId,
      userId: tokenData.userId,
      canDownload: false,
      reason: 'Document not found or access denied'
    }
  }
  
  // Check if document is ready for download
  if (document.status !== 'completed' && document.status !== 'enhanced') {
    return {
      documentId: tokenData.documentId,
      userId: tokenData.userId,
      canDownload: false,
      reason: 'Document is not ready for download'
    }
  }
  
  return {
    documentId: tokenData.documentId,
    userId: tokenData.userId,
    canDownload: true
  }
}

/**
 * Validate webhook signature for secure callbacks
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Generate download audit log entry
 */
export async function logDownloadAccess(
  documentId: string,
  userId: string,
  success: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  const supabase = await createClient()
  
  await supabase
    .from('audit_logs')
    .insert({
      user_id: userId,
      action: 'document_download',
      resource_type: 'document',
      resource_id: documentId,
      success,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    })
    .select()
    .single()
    .catch(error => {
      console.error('Failed to log download access:', error)
    })
}