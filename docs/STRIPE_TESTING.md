# Stripe Testing Guide

Quick reference for testing Stripe integration in BeautifyAI.

## Test Card Numbers

### Successful Payment Cards
| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Visa - Always succeeds |
| `4000 0025 0000 3155` | Visa - Requires 3D Secure authentication |
| `5555 5555 5554 4444` | Mastercard - Always succeeds |

### Failure Test Cards
| Card Number | Description |
|-------------|-------------|
| `4000 0000 0000 9995` | Declined - Insufficient funds |
| `4000 0000 0000 0002` | Declined - Generic decline |
| `4000 0000 0000 9987` | Declined - Lost card |

### Special Test Scenarios
| Card Number | Description |
|-------------|-------------|
| `4000 0000 0000 0341` | Attaching this card to a Customer fails |
| `4100 0000 0000 0019` | Charge succeeds with a risk_level of highest |

**Note**: Use any future expiry date, any 3-digit CVC, and any ZIP code with test cards.

## Testing Subscription Flows

### 1. New Subscription
```bash
# Terminal 1: Start your app
npm run dev

# Terminal 2: Start webhook listener
stripe listen --forward-to localhost:5000/api/stripe/webhook

# Add webhook secret to .env.local
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

1. Create account at http://localhost:5000/auth/signup
2. Go to Settings → Billing
3. Choose a plan and use test card `4242 4242 4242 4242`
4. Verify subscription activates

### 2. Upgrade/Downgrade
1. While subscribed, click different plan
2. Confirm plan change
3. Check webhook terminal for `customer.subscription.updated`
4. Verify new limits apply immediately

### 3. Cancel Subscription
1. Click "Cancel Subscription"
2. Confirm cancellation
3. Verify status shows "Cancelling at period end"
4. User retains access until period ends

### 4. Reactivate Subscription
1. After cancelling, click "Reactivate"
2. Subscription resumes without new payment
3. Status returns to "Active"

### 5. Payment Failure
1. Use card `4000 0000 0000 9995`
2. Payment will fail
3. Check webhook for `invoice.payment_failed`
4. User should see error message

## Webhook Testing Commands

### Trigger Specific Events
```bash
# Successful payment
stripe trigger payment_intent.succeeded

# Subscription created
stripe trigger customer.subscription.created

# Subscription updated
stripe trigger customer.subscription.updated

# Payment failed
stripe trigger invoice.payment_failed

# Subscription deleted
stripe trigger customer.subscription.deleted
```

### View Recent Events
```bash
# List recent events
stripe events list --limit 10

# Get details of specific event
stripe events retrieve evt_xxxxx
```

## Debugging Tips

### Check Webhook Delivery
1. Stripe Dashboard → Developers → Webhooks
2. Click on your endpoint
3. View "Webhook attempts" to see successes/failures

### Common Issues

**"No price ID found"**
- Ensure all Price IDs are in .env.local
- Restart Next.js after updating .env.local

**Webhook not received**
- Check `stripe listen` is running
- Verify STRIPE_WEBHOOK_SECRET is correct
- Check terminal for connection errors

**Subscription not updating in database**
- Check Supabase connection
- Verify webhook handler has no errors
- Check database user has stripe_customer_id

### Database Verification
```sql
-- Check user's subscription status
SELECT 
  email,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_tier,
  subscription_status,
  usage_count,
  usage_reset_at
FROM users
WHERE email = 'test@example.com';
```

## Testing Checklist

- [ ] Can create new subscription
- [ ] Can upgrade plan
- [ ] Can downgrade plan
- [ ] Can cancel subscription
- [ ] Can reactivate cancelled subscription
- [ ] Payment failures handled gracefully
- [ ] Usage limits enforced per tier
- [ ] Webhook events processed correctly
- [ ] Customer portal accessible
- [ ] Billing history shown

## Monitoring in Production

1. **Stripe Dashboard**
   - Payments → All transactions
   - Billing → Subscriptions
   - Developers → Logs

2. **Application Logs**
   - Check webhook endpoint logs
   - Monitor error tracking (Sentry)

3. **Database**
   - Monitor subscription_status changes
   - Track failed payment attempts

## Support Resources

- [Stripe Test Mode Documentation](https://stripe.com/docs/test-mode)
- [Testing Webhooks Locally](https://stripe.com/docs/webhooks/test)
- [Stripe API Reference](https://stripe.com/docs/api)