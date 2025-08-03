import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe/config';
import { syncSubscriptionStatus } from '@/lib/stripe/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionStatus(subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.supabase_user_id;
        
        if (userId) {
          await supabase
            .from('users')
            .update({
              subscription_tier: 'free',
              subscription_status: 'cancelled',
              stripe_subscription_id: null,
            })
            .eq('id', userId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Invoice objects have subscription as an object, not a string
        // Need to get subscription from the invoice lines
        if (invoice.lines?.data?.[0]?.subscription) {
          await syncSubscriptionStatus(invoice.lines.data[0].subscription as string);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Invoice objects have subscription as an object, not a string
        // Need to get subscription from the invoice lines
        if (invoice.lines?.data?.[0]?.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.lines.data[0].subscription as string);
          const userId = subscription.metadata.supabase_user_id;
          
          if (userId) {
            await supabase
              .from('users')
              .update({
                subscription_status: 'past_due',
              })
              .eq('id', userId);
          }
        }
        break;
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId = session.subscription as string;
          await syncSubscriptionStatus(subscriptionId);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}