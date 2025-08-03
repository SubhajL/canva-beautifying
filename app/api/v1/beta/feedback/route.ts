import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { APIErrorHandler } from '@/lib/utils/api-error-handler';
import { validateInput } from '@/lib/utils/validation';
import { z } from 'zod';
import { RateLimiter } from '@/lib/utils/validation';
import { securityLogger } from '@/lib/utils/security-logger';
import { v4 as uuidv4 } from 'uuid';

// Create a rate limiter for feedback submissions
const feedbackRateLimiter = new RateLimiter(10, 60 * 60 * 1000); // 10 feedback submissions per hour

// Validation schema for feedback submission
const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'improvement', 'general']),
  rating: z.number().min(1).max(5).optional(),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  page_url: z.string().url().optional(),
  browser_info: z.object({
    userAgent: z.string(),
    platform: z.string(),
    language: z.string(),
    screenResolution: z.string(),
    viewport: z.string(),
  }).optional(),
  attachments: z.array(z.object({
    url: z.string().url(),
    type: z.string(),
    size: z.number(),
  })).max(5).optional(),
});

export async function POST(request: NextRequest) {
  const requestId = uuidv4();

  try {
    // Check rate limit
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const isAllowed = feedbackRateLimiter.isAllowed(`feedback_${ip}`);

    if (!isAllowed) {
      await securityLogger.log({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        ip,
        message: 'Rate limit exceeded for beta feedback submission',
        metadata: {
          operation: 'feedback_submission',
        },
      });

      return APIErrorHandler.handleResponse(
        APIErrorHandler.createError(
          'Too many feedback submissions. Please try again later.',
          429,
          'RATE_LIMIT_EXCEEDED'
        ),
        requestId
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return APIErrorHandler.handleResponse(
        APIErrorHandler.createError('Unauthorized', 401, 'UNAUTHORIZED'),
        requestId
      );
    }

    // Check if user is a beta user
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_beta_user')
      .eq('id', user.id)
      .single();

    if (!profile?.is_beta_user) {
      return APIErrorHandler.handleResponse(
        APIErrorHandler.createError(
          'Beta access required',
          403,
          'BETA_ACCESS_REQUIRED'
        ),
        requestId
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = validateInput(feedbackSchema, body);

    // Insert feedback
    const { data: feedback, error: insertError } = await supabase
      .from('beta_feedback')
      .insert({
        user_id: user.id,
        feedback_type: validatedData.type,
        rating: validatedData.rating,
        title: validatedData.title,
        description: validatedData.description,
        page_url: validatedData.page_url,
        browser_info: validatedData.browser_info,
        attachments: validatedData.attachments || [],
        status: 'pending',
        priority: validatedData.type === 'bug' ? 'high' : 'medium',
      })
      .select()
      .single();

    if (insertError) {
      await APIErrorHandler.logError(
        APIErrorHandler.createError(
          'Failed to submit feedback',
          500,
          'FEEDBACK_SUBMIT_ERROR',
          { error: insertError }
        ),
        { userId: user.id, requestId }
      );

      return APIErrorHandler.handleResponse(
        APIErrorHandler.createError(
          'Failed to submit feedback. Please try again.',
          500,
          'INTERNAL_ERROR'
        ),
        requestId
      );
    }

    // Update feedback count in user profile
    await supabase.rpc('increment', {
      table_name: 'user_profiles',
      column_name: 'beta_feedback_count',
      row_id: user.id,
    });

    // Track analytics event
    await supabase.from('beta_analytics').insert({
      user_id: user.id,
      event_type: 'feedback_submitted',
      event_category: 'feedback',
      event_action: 'submit',
      event_label: validatedData.type,
      event_value: validatedData.rating,
      metadata: {
        feedback_id: feedback.id,
        has_attachments: !!validatedData.attachments?.length,
      },
    });

    // Log security event
    await securityLogger.log({
      type: 'suspicious_activity',
      severity: 'low',
      userId: user.id,
      message: 'Beta feedback submitted',
      metadata: {
        feedbackId: feedback.id,
        feedbackType: validatedData.type,
        hasAttachments: !!validatedData.attachments?.length,
      },
    });

    // Send notification to admin if it's a bug report
    if (validatedData.type === 'bug' && validatedData.rating && validatedData.rating <= 2) {
      // TODO: Implement admin notification system
      console.log('Critical bug report submitted:', feedback.id);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: feedback.id,
          message: 'Thank you for your feedback! We appreciate your help in improving BeautifyAI.',
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    await APIErrorHandler.logError(error as Error, { requestId });
    return APIErrorHandler.handleResponse(error as Error, requestId);
  }
}

// Get user's feedback history
export async function GET(request: NextRequest) {
  const requestId = uuidv4();

  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return APIErrorHandler.handleResponse(
        APIErrorHandler.createError('Unauthorized', 401, 'UNAUTHORIZED'),
        requestId
      );
    }

    // Check if user is a beta user
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_beta_user')
      .eq('id', user.id)
      .single();

    if (!profile?.is_beta_user) {
      return APIErrorHandler.handleResponse(
        APIErrorHandler.createError(
          'Beta access required',
          403,
          'BETA_ACCESS_REQUIRED'
        ),
        requestId
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    // Build query
    let query = supabase
      .from('beta_feedback')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('feedback_type', type);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: feedback, error: queryError, count } = await query;

    if (queryError) {
      throw queryError;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          feedback: feedback || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    await APIErrorHandler.logError(error as Error, { requestId });
    return APIErrorHandler.handleResponse(error as Error, requestId);
  }
}