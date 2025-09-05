import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/api/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { TIER_LIMITS } from '@/lib/subscription/tier-config';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await authenticateRequest(request);
    const supabase = await createClient();

    // Get user's subscription tier
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (userError) {
      return errorResponse('Failed to fetch user data', 500, { error: userError.message });
    }

    const tier = userData?.subscription_tier || 'free';
    const tierLimits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS];

    // Get current month's usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const { data: usageData, error: usageError } = await supabase
      .from('enhancements')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString());

    if (usageError) {
      return errorResponse('Failed to fetch usage data', 500, { error: usageError.message });
    }

    const used = usageData?.length || 0;
    const limit = tierLimits.monthlyCredits;

    return successResponse({
      used,
      limit,
      tier,
      period: {
        start: startOfMonth.toISOString(),
        end: endOfMonth.toISOString(),
      },
    });
  } catch (error) {
    console.error('Usage API error:', error);
    return errorResponse('Internal server error', 500);
  }
}