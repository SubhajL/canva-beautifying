export interface WelcomeEmailData {
  userName?: string
  subscriptionTier: 'free' | 'basic' | 'pro' | 'premium'
  appUrl: string
}

export const welcomeEmailTemplate = (data: WelcomeEmailData): { subject: string; html: string } => {
  const { userName = 'there', subscriptionTier = 'free', appUrl } = data

  const tierDetails = {
    free: {
      name: 'Free',
      features: ['5 enhancements per month', 'Basic AI models', 'Standard export formats'],
      color: '#6B7280'
    },
    basic: {
      name: 'Basic',
      features: ['50 enhancements per month', 'Advanced AI models', 'Priority processing', 'No watermarks'],
      color: '#3B82F6'
    },
    pro: {
      name: 'Pro',
      features: ['200 enhancements per month', 'All AI models', 'Batch processing', 'API access'],
      color: '#8B5CF6'
    },
    premium: {
      name: 'Premium',
      features: ['Unlimited enhancements', 'Ensemble AI processing', 'White-label options', 'Dedicated support'],
      color: '#EC4899'
    }
  }

  const tier = tierDetails[subscriptionTier]

  const subject = `Welcome to BeautifyAI! 🎨`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BeautifyAI</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F9FAFB;">
  <div style="padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <!-- Header -->
      <div style="background-color: #7C3AED; padding: 40px 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">
          Welcome to BeautifyAI! 🎨
        </h1>
      </div>

      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #1F2937; font-size: 24px; margin-bottom: 16px;">
          Hi ${userName}! 👋
        </h2>
        
        <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          We're thrilled to have you on board! BeautifyAI is here to transform your documents 
          into stunning visual masterpieces using the power of AI.
        </p>

        <!-- Subscription Info -->
        <div style="background-color: #F3F4F6; padding: 24px; border-radius: 8px; margin-bottom: 32px;">
          <h3 style="color: ${tier.color}; margin: 0 0 16px 0; font-size: 20px;">
            Your ${tier.name} Plan Includes:
          </h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${tier.features.map(feature => `
              <li style="color: #374151; margin-bottom: 8px;">${feature}</li>
            `).join('')}
          </ul>
        </div>

        <!-- Getting Started -->
        <div style="margin-bottom: 32px;">
          <h3 style="color: #1F2937; font-size: 20px; margin-bottom: 16px;">
            🚀 Get Started in 3 Easy Steps:
          </h3>
          <ol style="margin: 0; padding-left: 20px;">
            <li style="color: #4B5563; margin-bottom: 12px;">
              <strong>Upload</strong> your document (PDF, PNG, or JPG)
            </li>
            <li style="color: #4B5563; margin-bottom: 12px;">
              <strong>Choose</strong> your enhancement style and preferences
            </li>
            <li style="color: #4B5563; margin-bottom: 12px;">
              <strong>Download</strong> your beautifully enhanced document
            </li>
          </ol>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${appUrl}/app/dashboard" 
             style="display: inline-block; background-color: #7C3AED; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Start Enhancing Now
          </a>
        </div>

        <!-- Tips -->
        <div style="background-color: #FEF3C7; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
          <p style="margin: 0; color: #92400E; font-size: 14px;">
            <strong>💡 Pro Tip:</strong> For best results, upload high-resolution images 
            and provide clear descriptions of your target audience.
          </p>
        </div>

        <!-- Support -->
        <div style="border-top: 1px solid #E5E7EB; padding-top: 24px;">
          <p style="color: #6B7280; font-size: 14px; margin: 0;">
            Need help? We're here for you!
          </p>
          <p style="color: #6B7280; font-size: 14px; margin: 8px 0 0 0;">
            📧 Reply to this email<br>
            📚 Docs: <a href="${appUrl}/docs" style="color: #7C3AED;">beautifyai.com/docs</a>
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #F9FAFB; padding: 24px 30px; text-align: center;">
        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
          © 2024 BeautifyAI. All rights reserved.
        </p>
        <p style="color: #9CA3AF; font-size: 12px; margin: 8px 0 0 0;">
          You're receiving this because you signed up for BeautifyAI.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`

  return { subject, html }
}