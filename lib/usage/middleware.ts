import { NextRequest, NextResponse } from 'next/server';
import { createUsageTracker } from './tracking-server';
import { createClient } from '@/lib/supabase/server';

interface UsageLimitResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: {
      remainingCredits: number;
      monthlyLimit: number;
      upgradeUrl?: string;
    };
  };
}

/**
 * Middleware to check usage limits before allowing actions
 */
export async function checkUsageLimit(
  request: NextRequest,
  requiredCredits = 1
): Promise<UsageLimitResponse | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
    }

    const tracker = await createUsageTracker();
    const usage = await tracker.checkUsageLimit(user.id);

    // Check if user has enough credits
    if (usage.remainingCredits < requiredCredits) {
      return {
        success: false,
        error: {
          code: 'USAGE_LIMIT_EXCEEDED',
          message: 'Monthly usage limit exceeded',
          details: {
            remainingCredits: usage.remainingCredits,
            monthlyLimit: usage.monthlyCredits,
            upgradeUrl: '/app/settings/billing',
          },
        },
      };
    }

    // Check if approaching limit (80% used)
    if (usage.percentageUsed >= 80 && usage.percentageUsed < 100) {
      // Add warning header but allow request
      const response = NextResponse.next();
      response.headers.set(
        'X-Usage-Warning',
        `You have used ${Math.round(usage.percentageUsed)}% of your monthly credits`
      );
      response.headers.set('X-Remaining-Credits', usage.remainingCredits.toString());
      return null; // Continue with request
    }

    return null; // All good, continue
  } catch (error) {
    console.error('Usage limit check error:', error);
    // Don't block on errors
    return null;
  }
}

/**
 * Track usage after successful action
 */
export async function trackUsageAfterSuccess(
  userId: string,
  action: 'enhancement' | 'batch_enhancement' | 'api_call' | 'export',
  enhancementId?: string,
  credits = 1
): Promise<void> {
  try {
    const tracker = await createUsageTracker();
    await tracker.trackUsage({
      userId,
      action,
      enhancementId,
      credits,
    });
  } catch (error) {
    console.error('Failed to track usage:', error);
    // Don't throw - we don't want to fail the request if tracking fails
  }
}

interface APIContext {
  params?: Record<string, string>;
  // Allow additional properties
  [key: string]: unknown;
}

/**
 * Decorator function for API routes that consume credits
 */
export function withUsageLimit(
  handler: (req: NextRequest, context?: APIContext) => Promise<NextResponse>,
  requiredCredits = 1
) {
  return async (req: NextRequest, context?: APIContext): Promise<NextResponse> => {
    const limitCheck = await checkUsageLimit(req, requiredCredits);
    
    if (limitCheck && !limitCheck.success) {
      return NextResponse.json(limitCheck, { status: 402 }); // Payment Required
    }

    // Execute the original handler
    const response = await handler(req, context);

    // If successful, track usage
    if (response.status >= 200 && response.status < 300) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Extract action type from the request
        const action = req.url.includes('/api/v1/') ? 'api_call' : 'enhancement';
        await trackUsageAfterSuccess(user.id, action, undefined, requiredCredits);
      }
    }

    return response;
  };
}