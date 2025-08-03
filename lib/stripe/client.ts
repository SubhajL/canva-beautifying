import { stripe, getTierByPriceId } from './config';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type _User = Database['public']['Tables']['users']['Row'];

export async function createOrRetrieveCustomer(userId: string, email: string): Promise<string> {
  const supabase = await createClient();
  
  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (user?.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  await supabase
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer.id;
}

export async function createCheckoutSession({
  userId,
  email,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  email: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const customerId = await createOrRetrieveCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        supabase_user_id: userId,
      },
      trial_period_days: 14, // 14-day free trial
    },
    metadata: {
      supabase_user_id: userId,
    },
    allow_promotion_codes: true,
  });

  return session;
}

export async function createBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

export async function updateSubscription({
  subscriptionId,
  newPriceId,
}: {
  subscriptionId: string;
  newPriceId: string;
}) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: 'create_prorations',
  });

  return updatedSubscription;
}

export async function cancelSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  return subscription;
}

export async function reactivateSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });

  return subscription;
}

export async function getSubscriptionDetails(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['latest_invoice', 'default_payment_method'],
  });

  return subscription;
}

export async function getCustomerInvoices(customerId: string, limit = 10) {
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });

  return invoices.data;
}

export async function getPaymentMethods(customerId: string) {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });

  return paymentMethods.data;
}

export async function attachPaymentMethod({
  customerId,
  paymentMethodId,
}: {
  customerId: string;
  paymentMethodId: string;
}) {
  const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });

  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  return paymentMethod;
}

export async function detachPaymentMethod(paymentMethodId: string) {
  const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
  return paymentMethod;
}

export async function syncSubscriptionStatus(subscriptionId: string) {
  const supabase = await createClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  const tier = getTierByPriceId(subscription.items.data[0].price.id);
  if (!tier) {
    throw new Error('Invalid subscription price ID');
  }

  const userId = subscription.metadata.supabase_user_id;
  if (!userId) {
    throw new Error('Subscription missing user ID metadata');
  }

  let status: Database['public']['Enums']['subscription_status'];
  switch (subscription.status) {
    case 'active':
      status = 'active';
      break;
    case 'canceled':
      status = 'cancelled';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'trialing':
      status = 'trialing';
      break;
    default:
      status = 'cancelled';
  }

  await supabase
    .from('users')
    .update({
      subscription_tier: tier.id as Database['public']['Enums']['subscription_tier'],
      subscription_status: status,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', userId);

  return { tier: tier.id, status };
}