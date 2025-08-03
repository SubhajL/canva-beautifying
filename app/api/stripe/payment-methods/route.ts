import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  getPaymentMethods, 
  attachPaymentMethod, 
  detachPaymentMethod,
  createOrRetrieveCustomer 
} from '@/lib/stripe/client';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.stripe_customer_id) {
      return NextResponse.json({ paymentMethods: [] });
    }

    const paymentMethods = await getPaymentMethods(userData.stripe_customer_id);
    
    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error('Get payment methods error:', error);
    return NextResponse.json(
      { error: 'Failed to get payment methods' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentMethodId } = await request.json();

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID required' }, { status: 400 });
    }

    const customerId = await createOrRetrieveCustomer(user.id, user.email!);

    const paymentMethod = await attachPaymentMethod({
      customerId,
      paymentMethodId,
    });

    return NextResponse.json({ paymentMethod });
  } catch (error) {
    console.error('Attach payment method error:', error);
    return NextResponse.json(
      { error: 'Failed to attach payment method' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentMethodId } = await request.json();

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Payment method ID required' }, { status: 400 });
    }

    await detachPaymentMethod(paymentMethodId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Detach payment method error:', error);
    return NextResponse.json(
      { error: 'Failed to detach payment method' },
      { status: 500 }
    );
  }
}