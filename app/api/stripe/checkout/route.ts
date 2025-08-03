import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/client';
import { SUBSCRIPTION_TIERS } from '@/lib/stripe/config';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId, tier } = await request.json();

    if (!priceId || !tier) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validTier = Object.values(SUBSCRIPTION_TIERS).find(t => t.id === tier && t.priceId === priceId);
    if (!validTier) {
      return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || 'http://localhost:5000';
    
    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email!,
      priceId,
      successUrl: `${origin}/app/settings/billing?success=true`,
      cancelUrl: `${origin}/app/settings/billing?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}