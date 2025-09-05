import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { EnhancementService } from '@/lib/enhancement';
import { checkUsageLimit, trackUsageAfterSuccess } from '@/lib/usage/middleware';
import { createErrorResponse, ErrorFactory, createValidationError } from '@/lib/utils/create-safe-error';
import { withDualRateLimit } from '@/lib/api/middleware/dual-rate-limit';
import { APIRequestContext } from '@/lib/api/types';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for batch processing

// Batch size limits by tier
const BATCH_LIMITS = {
  free: 1,
  basic: 3,
  pro: 5,
  premium: 10,
};

interface BatchEnhanceRequest {
  documentIds: string[];
  preferences?: {
    selectedModel?: string;
    targetAudience?: string;
    gradeLevel?: string;
    subject?: string;
    purpose?: string;
    enhancementStyle?: string;
    colorScheme?: string;
    visualComplexity?: 'simple' | 'moderate' | 'detailed';
    includeGraphics?: boolean;
    includeCharts?: boolean;
  };
}

async function batchEnhanceHandler(request: NextRequest, context?: APIRequestContext) {
  const requestId = context?.requestId || request.headers.get('x-request-id') || undefined;

  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const error = ErrorFactory.authRequired();
      const { status, body } = createErrorResponse(error, requestId);
      return NextResponse.json(body, { status });
    }

    // Parse request body
    const body: BatchEnhanceRequest = await request.json();
    const { documentIds, preferences = {} } = body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      const error = createValidationError('documentIds', 'Document IDs array is required and must not be empty');
      const { status, body: errorBody } = createErrorResponse(error, requestId);
      return NextResponse.json(errorBody, { status });
    }

    // Get user's subscription tier
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = userProfile?.subscription_tier || 'free';
    const batchLimit = BATCH_LIMITS[tier as keyof typeof BATCH_LIMITS] || BATCH_LIMITS.free;

    // Check batch size against tier limit
    if (documentIds.length > batchLimit) {
      const error = createValidationError(
        'documentIds', 
        `Batch size exceeds limit for ${tier} tier (max: ${batchLimit})`
      );
      const { status, body: errorBody } = createErrorResponse(error, requestId);
      return NextResponse.json(errorBody, { status });
    }

    // Check usage limits
    const limitCheck = await checkUsageLimit(request, documentIds.length);
    if (limitCheck && !limitCheck.success) {
      return NextResponse.json(limitCheck, { status: 402 });
    }

    // Validate all document IDs exist and belong to user
    const { data: documents, error: docError } = await supabase
      .from('enhancements')
      .select('id, user_id, status')
      .in('id', documentIds);

    if (docError || !documents) {
      const error = ErrorFactory.database('Failed to validate documents');
      const { status, body: errorBody } = createErrorResponse(error, requestId);
      return NextResponse.json(errorBody, { status });
    }

    // Check all documents belong to user
    const unauthorizedDocs = documents.filter(doc => doc.user_id !== user.id);
    if (unauthorizedDocs.length > 0) {
      const error = ErrorFactory.forbidden();
      const { status, body: errorBody } = createErrorResponse(error, requestId);
      return NextResponse.json(errorBody, { status });
    }

    // Check all documents are in uploaded state
    const invalidDocs = documents.filter(doc => doc.status !== 'uploaded');
    if (invalidDocs.length > 0) {
      const error = createValidationError(
        'documentIds',
        `Some documents are not ready for enhancement: ${invalidDocs.map(d => d.id).join(', ')}`
      );
      const { status, body: errorBody } = createErrorResponse(error, requestId);
      return NextResponse.json(errorBody, { status });
    }

    // Generate batch ID
    const batchId = uuidv4();

    // Initialize enhancement service
    const enhancementService = new EnhancementService();

    // Process each document
    const enhancementPromises = documentIds.map(async (documentId) => {
      try {
        const result = await enhancementService.enhanceDocument(
          documentId,
          user.id,
          preferences
        );

        return {
          documentId,
          success: result.success,
          enhancementId: result.enhancementId,
          jobId: result.jobId,
          error: result.error,
        };
      } catch (error) {
        console.error(`Failed to enhance document ${documentId}:`, error);
        return {
          documentId,
          success: false,
          error: error instanceof Error ? error.message : 'Enhancement failed',
        };
      }
    });

    // Wait for all enhancements to be queued
    const results = await Promise.all(enhancementPromises);

    // Track successful enhancements
    const successfulCount = results.filter(r => r.success).length;
    if (successfulCount > 0) {
      await trackUsageAfterSuccess(user.id, 'batch_enhancement', batchId, successfulCount);
    }

    // Create batch record in database
    const { error: batchError } = await supabase
      .from('enhancement_batches')
      .insert({
        id: batchId,
        user_id: user.id,
        document_ids: documentIds,
        preferences,
        total_documents: documentIds.length,
        successful_documents: successfulCount,
        status: successfulCount === documentIds.length ? 'processing' : 'partial',
      });

    if (batchError) {
      console.error('Failed to create batch record:', batchError);
    }

    return NextResponse.json({
      success: true,
      batchId,
      totalDocuments: documentIds.length,
      queued: successfulCount,
      failed: documentIds.length - successfulCount,
      results,
    });
  } catch (error) {
    const { status, body, headers } = createErrorResponse(error, requestId);
    
    return NextResponse.json(body, { 
      status,
      headers: headers ? new Headers(headers) : undefined
    });
  }
}

// Export with dual rate limiting middleware
export const POST = withDualRateLimit(batchEnhanceHandler, {
  endpoint: 'batch_enhance'
});

async function getBatchStatusHandler(request: NextRequest, context?: APIRequestContext) {
  const requestId = context?.requestId || request.headers.get('x-request-id') || undefined;

  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      const error = ErrorFactory.authRequired();
      const { status, body } = createErrorResponse(error, requestId);
      return NextResponse.json(body, { status });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      const error = createValidationError('batchId', 'Batch ID is required');
      const { status, body: errorBody } = createErrorResponse(error, requestId);
      return NextResponse.json(errorBody, { status });
    }

    // Get batch record
    const { data: batch, error: batchError } = await supabase
      .from('enhancement_batches')
      .select('*')
      .eq('id', batchId)
      .eq('user_id', user.id)
      .single();

    if (batchError || !batch) {
      const error = ErrorFactory.notFound('Batch not found');
      const { status, body: errorBody } = createErrorResponse(error, requestId);
      return NextResponse.json(errorBody, { status });
    }

    // Get status of all documents in batch
    const { data: enhancements, error: enhError } = await supabase
      .from('enhancements')
      .select('id, status, enhanced_url, analysis_data')
      .in('id', batch.document_ids);

    if (enhError) {
      const error = ErrorFactory.database('Failed to get enhancement status');
      const { status, body: errorBody } = createErrorResponse(error, requestId);
      return NextResponse.json(errorBody, { status });
    }

    // Calculate batch status
    const statuses = enhancements?.map(e => e.status) || [];
    const completed = statuses.filter(s => s === 'completed').length;
    const failed = statuses.filter(s => s === 'error').length;
    const processing = statuses.filter(s => ['processing', 'analyzing'].includes(s)).length;

    let batchStatus = 'processing';
    if (completed + failed === batch.document_ids.length) {
      batchStatus = failed > 0 ? 'partial_complete' : 'completed';
    }

    return NextResponse.json({
      batchId,
      status: batchStatus,
      totalDocuments: batch.document_ids.length,
      completed,
      failed,
      processing,
      documents: enhancements?.map(e => ({
        documentId: e.id,
        status: e.status,
        enhancedUrl: e.enhanced_url,
        metadata: e.analysis_data,
      })),
      createdAt: batch.created_at,
      updatedAt: batch.updated_at,
    });
  } catch (error) {
    const { status, body, headers } = createErrorResponse(error, requestId);
    
    return NextResponse.json(body, { 
      status,
      headers: headers ? new Headers(headers) : undefined
    });
  }
}

// Export with dual rate limiting middleware
export const GET = withDualRateLimit(getBatchStatusHandler, {
  endpoint: 'batch_enhance'
});