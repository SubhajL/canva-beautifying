import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  updateSubscription, 
  cancelSubscription, 
  reactivateSubscription,
  getSubscriptionDetails 
} from '@/lib/stripe/client';
import { SUBSCRIPTION_TIERS } from '@/lib/stripe/config';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.stripe_subscription_id) {
      return NextResponse.json({ subscription: null });
    }

    const subscription = await getSubscriptionDetails(userData.stripe_subscription_id);
    
    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription details' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, priceId } = await request.json();

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_subscription_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'upgrade':
      case 'downgrade':
        if (!priceId) {
          return NextResponse.json({ error: 'Price ID required' }, { status: 400 });
        }
        
        const validTier = Object.values(SUBSCRIPTION_TIERS).find(t => t.priceId === priceId);
        if (!validTier) {
          return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
        }
        
        result = await updateSubscription({
          subscriptionId: userData.stripe_subscription_id,
          newPriceId: priceId,
        });
        break;

      case 'cancel':
        result = await cancelSubscription(userData.stripe_subscription_id);
        break;

      case 'reactivate':
        result = await reactivateSubscription(userData.stripe_subscription_id);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ subscription: result });
  } catch (error) {
    console.error('Update subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}