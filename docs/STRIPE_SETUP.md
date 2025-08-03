# Stripe Setup Guide for BeautifyAI

This guide will help you set up Stripe for subscription payments in your local development environment.

## Prerequisites

- Node.js and npm installed
- BeautifyAI application set up locally
- Stripe account (free to create at [stripe.com](https://stripe.com))

## Step 1: Install Stripe CLI

### macOS (using Homebrew)
```bash
brew install stripe/stripe-cli/stripe
```

### Windows (using Scoop)
```bash
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

### Linux
```bash
# Download the latest linux tar.gz file from https://github.com/stripe/stripe-cli/releases/latest
tar -xvf stripe_*.tar.gz
sudo mv stripe /usr/local/bin
```

### Alternative: Download directly
Visit https://stripe.com/docs/stripe-cli#install and download for your OS.

## Step 2: Login to Stripe CLI

```bash
stripe login
```

This will open your browser to authenticate. Press Enter to continue and follow the prompts.

## Step 3: Create Products in Stripe Dashboard

1. Login to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test Mode** (toggle in top-right)
3. Go to **Products** → **Add Product**

### Create these three products:

#### Basic Plan
- **Name**: BeautifyAI Basic
- **Description**: 50 document enhancements per month
- **Pricing**: 
  - Model: Standard pricing
  - Price: $9.99
  - Billing period: Monthly
- **Save the Price ID** (starts with `price_`)

#### Pro Plan
- **Name**: BeautifyAI Pro
- **Description**: 200 document enhancements per month with priority processing
- **Pricing**: 
  - Price: $24.99
  - Billing period: Monthly
- **Save the Price ID**

#### Premium Plan
- **Name**: BeautifyAI Premium
- **Description**: Unlimited enhancements with all premium features
- **Pricing**: 
  - Price: $49.99
  - Billing period: Monthly
- **Save the Price ID**

## Step 4: Get Your API Keys

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Copy your keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

## Step 5: Configure Environment Variables

Create or update your `.env.local` file:

```env
# Stripe API Keys
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY

# Stripe Price IDs (from Step 3)
STRIPE_BASIC_PRICE_ID=price_YOUR_BASIC_PRICE_ID
STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PRICE_ID
STRIPE_PREMIUM_PRICE_ID=price_YOUR_PREMIUM_PRICE_ID

# Webhook secret will be added in next step
STRIPE_WEBHOOK_SECRET=
```

## Step 6: Start Webhook Forwarding

1. **Start your Next.js application** (if not already running):
   ```bash
   npm run dev
   ```

2. **In a new terminal**, start Stripe webhook forwarding:
   ```bash
   stripe listen --forward-to localhost:5000/api/stripe/webhook
   ```

3. **Copy the webhook signing secret** that appears:
   ```
   > Ready! Your webhook signing secret is whsec_abcd1234...
   ```

4. **Add it to your `.env.local`**:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
   ```

5. **Restart your Next.js server** to load the new environment variable.

## Step 7: Test the Integration

### Test Subscription Flow

1. **Create a test account** in your app:
   - Go to http://localhost:5000/auth/signup
   - Create an account with any email

2. **Navigate to billing**:
   - Go to Settings → Billing
   - Or directly visit http://localhost:5000/app/settings/billing

3. **Test upgrading to a paid plan**:
   - Click on any plan (Basic, Pro, or Premium)
   - In the Stripe Checkout page, use test card details:
     - Card number: `4242 4242 4242 4242`
     - Expiry: Any future date (e.g., `12/34`)
     - CVC: Any 3 digits (e.g., `123`)
     - ZIP: Any valid ZIP code

4. **Verify the subscription**:
   - After successful payment, you'll be redirected back
   - Your billing page should show the active subscription
   - Check the terminal running `stripe listen` - you should see webhook events

### Test Webhook Events

In a third terminal, you can trigger test events:

```bash
# Test successful payment
stripe trigger payment_intent.succeeded

# Test subscription update
stripe trigger customer.subscription.updated

# Test failed payment
stripe trigger invoice.payment_failed
```

## Step 8: Verify Database Updates

Check that the subscription data is saved correctly:

```bash
# If you have psql installed and Supabase CLI
supabase db sql "SELECT email, subscription_tier, subscription_status, stripe_customer_id FROM users WHERE email = 'your-test-email@example.com'"
```

Or check via Supabase Dashboard → Table Editor → Users table.

## Common Test Scenarios

### Cancel Subscription
1. On billing page, click "Cancel Subscription"
2. Verify webhook processes the cancellation
3. User should retain access until period ends

### Reactivate Subscription
1. After cancelling, click "Reactivate Subscription"
2. Subscription should resume without new payment

### Change Plans
1. Click on a different plan while subscribed
2. Stripe will prorate the payment
3. Verify plan changes immediately

## Troubleshooting

### "No webhook endpoint signing secret found"
- Make sure `STRIPE_WEBHOOK_SECRET` is in `.env.local`
- Restart Next.js server after adding it

### "No such price"
- Verify Price IDs are correctly copied from Stripe Dashboard
- Ensure you're using Test Mode prices (not Live Mode)

### Webhook events not showing
- Check that `stripe listen` is running
- Verify the forward URL matches your app port (5000)
- Check for errors in the `stripe listen` terminal

### Subscription not updating
- Check both terminals for error messages
- Verify database connection is working
- Check Stripe Dashboard → Developers → Logs

## Next Steps

1. **Test all subscription tiers** to ensure limits work correctly
2. **Monitor webhook reliability** in Stripe Dashboard → Webhooks
3. **Set up production webhooks** when deploying to production

## Production Deployment

When ready for production:
1. Use Live Mode API keys
2. Create Live Mode products/prices
3. Configure webhook endpoint in Stripe Dashboard:
   ```
   https://yourdomain.com/api/stripe/webhook
   ```
4. Update environment variables in your hosting platform

## Additional Resources

- [Stripe Testing Documentation](https://stripe.com/docs/testing)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)