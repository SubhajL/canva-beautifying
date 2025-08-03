import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/config';

/**
 * Reset usage count for users at the start of their billing cycle
 */
export async function resetUsageForBillingCycle(userId: string): Promise<void> {
  const supabase = await createClient();
  
  try {
    // Get user's subscription details
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_subscription_id, subscription_tier')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Failed to get user for usage reset:', userError);
      return;
    }

    // Free tier users reset on the 1st of each month
    if (user.subscription_tier === 'free' || !user.stripe_subscription_id) {
      const today = new Date();
      if (today.getDate() === 1) {
        await resetUserUsage(userId);
      }
      return;
    }

    // For paid users, check their billing cycle
    const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
    
    // Check if we're at the start of a new billing period
    const currentPeriodStart = new Date(subscription.current_period_start * 1000);
    const lastReset = await getLastResetDate(userId);
    
    if (!lastReset || currentPeriodStart > lastReset) {
      await resetUserUsage(userId);
      await recordResetDate(userId, currentPeriodStart);
    }
  } catch (error) {
    console.error('Failed to reset usage for billing cycle:', error);
  }
}

/**
 * Reset a user's usage count
 */
async function resetUserUsage(userId: string): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('users')
    .update({ usage_count: 0 })
    .eq('id', userId);

  if (error) {
    console.error('Failed to reset user usage:', error);
    throw error;
  }

  console.log(`Reset usage for user ${userId}`);
}

/**
 * Get the last usage reset date for a user
 */
async function getLastResetDate(userId: string): Promise<Date | null> {
  const supabase = await createClient();
  
  // We'll use the usage_tracking table to find the last reset
  // A reset is indicated by a specific action type
  const { data, error } = await supabase
    .from('usage_tracking')
    .select('created_at')
    .eq('user_id', userId)
    .eq('action', 'usage_reset')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return new Date(data.created_at);
}

/**
 * Record that a usage reset occurred
 */
async function recordResetDate(userId: string, resetDate: Date): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('usage_tracking')
    .insert({
      user_id: userId,
      action: 'usage_reset',
      credits_used: 0,
      created_at: resetDate.toISOString(),
    });

  if (error) {
    console.error('Failed to record reset date:', error);
  }
}

/**
 * Check all users for billing cycle resets
 * This should be called periodically (e.g., daily via cron)
 */
export async function checkAllUsersForReset(): Promise<void> {
  const supabase = await createClient();
  
  try {
    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select('id');

    if (error || !users) {
      console.error('Failed to get users for reset check:', error);
      return;
    }

    // Check each user
    for (const user of users) {
      await resetUsageForBillingCycle(user.id);
    }
  } catch (error) {
    console.error('Failed to check users for reset:', error);
  }
}

/**
 * Get the next reset date for a user
 */
export async function getNextResetDate(userId: string): Promise<Date | null> {
  const supabase = await createClient();
  
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('stripe_subscription_id, subscription_tier')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return null;
    }

    // Free tier resets on the 1st of next month
    if (user.subscription_tier === 'free' || !user.stripe_subscription_id) {
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return nextMonth;
    }

    // For paid users, get from Stripe
    const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
    return new Date(subscription.current_period_end * 1000);
  } catch (error) {
    console.error('Failed to get next reset date:', error);
    return null;
  }
}