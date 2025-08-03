export interface SubscriptionEmailData {
  userName?: string
  action: 'created' | 'upgraded' | 'downgraded' | 'cancelled' | 'renewed'
  planName: 'Basic' | 'Pro' | 'Premium'
  previousPlanName?: string
  amount: string
  interval: 'month' | 'year'
  nextBillingDate?: string
  features: string[]
  appUrl: string
}

export const subscriptionEmailTemplate = (data: SubscriptionEmailData): { subject: string; html: string } => {
  const {
    userName = 'there',
    action,
    planName,
    previousPlanName,
    amount,
    interval,
    nextBillingDate,
    features,
    appUrl
  } = data

  const actionMessages = {
    created: {
      subject: `Welcome to BeautifyAI ${planName}! 🎉`,
      title: 'Subscription Confirmed!',
      message: `Your ${planName} subscription is now active.`
    },
    upgraded: {
      subject: `You've been upgraded to ${planName}! 🚀`,
      title: 'Upgrade Successful!',
      message: `You've successfully upgraded from ${previousPlanName} to ${planName}.`
    },
    downgraded: {
      subject: `Your plan has been changed to ${planName}`,
      title: 'Plan Change Confirmed',
      message: `Your plan has been changed from ${previousPlanName} to ${planName}.`
    },
    cancelled: {
      subject: 'Your BeautifyAI subscription has been cancelled',
      title: 'Subscription Cancelled',
      message: `Your ${planName} subscription has been cancelled. You'll continue to have access until the end of your billing period.`
    },
    renewed: {
      subject: `Your BeautifyAI ${planName} subscription renewed`,
      title: 'Subscription Renewed',
      message: `Your ${planName} subscription has been successfully renewed.`
    }
  }

  const { subject, title, message } = actionMessages[action]

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F9FAFB;">
  <div style="padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <!-- Header -->
      <div style="background-color: #7C3AED; padding: 40px 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">
          ${title}
        </h1>
      </div>

      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #1F2937; font-size: 24px; margin-bottom: 16px;">
          Hi ${userName}!
        </h2>
        
        <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          ${message}
        </p>

        ${action !== 'cancelled' ? `
        <!-- Billing Details -->
        <div style="background-color: #F3F4F6; padding: 24px; border-radius: 8px; margin-bottom: 32px;">
          <h3 style="color: #1F2937; margin: 0 0 16px 0; font-size: 20px;">
            Billing Details
          </h3>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Plan:</td>
              <td style="padding: 8px 0; color: #1F2937; font-weight: bold; text-align: right;">${planName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Amount:</td>
              <td style="padding: 8px 0; color: #1F2937; font-weight: bold; text-align: right;">${amount}/${interval}</td>
            </tr>
            ${nextBillingDate ? `
            <tr>
              <td style="padding: 8px 0; color: #6B7280;">Next billing date:</td>
              <td style="padding: 8px 0; color: #1F2937; font-weight: bold; text-align: right;">${nextBillingDate}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <!-- Features -->
        <div style="margin-bottom: 32px;">
          <h3 style="color: #1F2937; font-size: 20px; margin-bottom: 16px;">
            Your ${planName} Features:
          </h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${features.map(feature => `
              <li style="color: #4B5563; margin-bottom: 8px;">
                ✓ ${feature}
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}

        <!-- Actions -->
        <div style="text-align: center; margin-bottom: 24px;">
          ${action === 'cancelled' ? `
            <a href="${appUrl}/pricing" 
               style="display: inline-block; background-color: #7C3AED; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
              Reactivate Subscription
            </a>
          ` : `
            <a href="${appUrl}/app/dashboard" 
               style="display: inline-block; background-color: #7C3AED; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
              Go to Dashboard
            </a>
          `}
        </div>

        <!-- Quick Links -->
        <div style="border-top: 1px solid #E5E7EB; padding-top: 24px;">
          <p style="color: #6B7280; font-size: 14px; margin: 0 0 12px 0;">
            Quick Links:
          </p>
          <ul style="margin: 0; padding-left: 20px;">
            <li style="color: #6B7280; margin-bottom: 8px;">
              <a href="${appUrl}/account/billing" style="color: #7C3AED;">Manage billing</a>
            </li>
            <li style="color: #6B7280; margin-bottom: 8px;">
              <a href="${appUrl}/pricing" style="color: #7C3AED;">View all plans</a>
            </li>
            <li style="color: #6B7280; margin-bottom: 8px;">
              <a href="${appUrl}/account/invoices" style="color: #7C3AED;">Download invoices</a>
            </li>
          </ul>
        </div>

        <!-- Support -->
        <div style="background-color: #FEF3C7; padding: 16px; border-radius: 8px; margin-top: 24px;">
          <p style="margin: 0; color: #92400E; font-size: 14px;">
            <strong>Need help?</strong> Reply to this email or visit our 
            <a href="${appUrl}/support" style="color: #7C3AED;">support center</a>.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #F9FAFB; padding: 24px 30px; text-align: center;">
        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
          © 2024 BeautifyAI. All rights reserved.
        </p>
        <p style="color: #9CA3AF; font-size: 12px; margin: 8px 0 0 0;">
          This is a billing notification for your BeautifyAI account.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`

  return { subject, html }
}