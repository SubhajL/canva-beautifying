export interface ErrorNotificationEmailData {
  userName?: string
  documentName: string
  enhancementId: string
  errorType: 'processing' | 'ai_failure' | 'storage' | 'timeout' | 'unknown'
  errorDetails?: string
  attemptNumber: number
  willRetry: boolean
  supportTicketUrl?: string
  appUrl: string
}

export const errorNotificationEmailTemplate = (data: ErrorNotificationEmailData): { subject: string; html: string } => {
  const {
    userName = 'there',
    documentName,
    enhancementId,
    errorType,
    errorDetails,
    attemptNumber,
    willRetry,
    supportTicketUrl,
    appUrl
  } = data

  const errorMessages = {
    processing: {
      title: 'Processing Error',
      description: 'We encountered an issue while enhancing your document.',
      icon: '⚙️'
    },
    ai_failure: {
      title: 'AI Service Temporary Issue',
      description: 'Our AI service is temporarily unavailable.',
      icon: '🤖'
    },
    storage: {
      title: 'Storage Issue',
      description: 'We had trouble saving your enhanced document.',
      icon: '💾'
    },
    timeout: {
      title: 'Processing Timeout',
      description: 'Your document is taking longer than expected to process.',
      icon: '⏱️'
    },
    unknown: {
      title: 'Unexpected Error',
      description: 'An unexpected error occurred during enhancement.',
      icon: '❓'
    }
  }

  const error = errorMessages[errorType]
  const subject = `${error.icon} Issue with your document enhancement`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhancement Error</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F9FAFB;">
  <div style="padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <!-- Header -->
      <div style="background-color: #DC2626; padding: 40px 30px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">${error.icon}</div>
        <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">
          ${error.title}
        </h1>
      </div>

      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #1F2937; font-size: 24px; margin-bottom: 16px;">
          Hi ${userName},
        </h2>
        
        <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          ${error.description} We apologize for the inconvenience.
        </p>

        <!-- Error Details -->
        <div style="background-color: #FEF2F2; padding: 24px; border-radius: 8px; margin-bottom: 32px;">
          <h3 style="color: #991B1B; margin: 0 0 16px 0; font-size: 18px;">
            Error Details
          </h3>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #DC2626; font-size: 14px;">Document:</td>
              <td style="padding: 8px 0; color: #1F2937; font-size: 14px; text-align: right;">
                <strong>${documentName}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #DC2626; font-size: 14px;">Enhancement ID:</td>
              <td style="padding: 8px 0; color: #1F2937; font-size: 14px; text-align: right;">
                <code style="background-color: #FEE2E2; padding: 2px 6px; border-radius: 4px;">${enhancementId}</code>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #DC2626; font-size: 14px;">Attempt:</td>
              <td style="padding: 8px 0; color: #1F2937; font-size: 14px; text-align: right;">
                ${attemptNumber} of 3
              </td>
            </tr>
            ${errorDetails ? `
            <tr>
              <td colspan="2" style="padding: 12px 0 0 0;">
                <div style="background-color: white; padding: 12px; border-radius: 4px; border: 1px solid #FCA5A5;">
                  <code style="font-size: 12px; color: #7F1D1D; word-break: break-all;">
                    ${errorDetails}
                  </code>
                </div>
              </td>
            </tr>
            ` : ''}
          </table>
        </div>

        ${willRetry ? `
        <!-- Retry Notice -->
        <div style="background-color: #FEF3C7; padding: 20px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
          <p style="color: #92400E; font-size: 16px; margin: 0;">
            <strong>🔄 We'll automatically retry in a few minutes</strong>
          </p>
          <p style="color: #92400E; font-size: 14px; margin: 8px 0 0 0;">
            No action needed from your side. We'll email you once it's complete.
          </p>
        </div>
        ` : `
        <!-- Action Required -->
        <div style="background-color: #DBEAFE; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h4 style="color: #1E40AF; margin: 0 0 12px 0; font-size: 16px;">
            What can you do?
          </h4>
          <ol style="margin: 0; padding-left: 20px; color: #3B82F6; font-size: 14px;">
            <li style="margin-bottom: 8px;">
              <a href="${appUrl}/app/upload" style="color: #2563EB;">Try uploading the document again</a>
            </li>
            <li style="margin-bottom: 8px;">
              Check if your document meets our <a href="${appUrl}/docs/requirements" style="color: #2563EB;">requirements</a>
            </li>
            <li style="margin-bottom: 8px;">
              Try a different file format (PNG, JPG, or PDF)
            </li>
          </ol>
        </div>
        `}

        <!-- Support -->
        <div style="border: 1px solid #E5E7EB; padding: 20px; border-radius: 8px; text-align: center;">
          <h4 style="color: #1F2937; margin: 0 0 12px 0; font-size: 16px;">
            Need Help? We're Here! 🤝
          </h4>
          <p style="color: #6B7280; font-size: 14px; margin: 0 0 16px 0;">
            Our support team is ready to assist you.
          </p>
          ${supportTicketUrl ? `
            <a href="${supportTicketUrl}" 
               style="display: inline-block; background-color: #7C3AED; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: bold;">
              View Support Ticket
            </a>
          ` : `
            <a href="${appUrl}/support?enhancement=${enhancementId}" 
               style="display: inline-block; background-color: #7C3AED; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: bold;">
              Contact Support
            </a>
          `}
          <p style="color: #9CA3AF; font-size: 12px; margin: 12px 0 0 0;">
            Or reply to this email with any questions
          </p>
        </div>

        <!-- Account Credit Notice -->
        <div style="background-color: #F0FDF4; padding: 16px; border-radius: 8px; margin-top: 24px;">
          <p style="margin: 0; color: #166534; font-size: 14px; text-align: center;">
            <strong>✅ Don't worry!</strong> This enhancement won't count against your monthly limit.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #F9FAFB; padding: 24px 30px; text-align: center;">
        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
          © 2024 BeautifyAI. All rights reserved.
        </p>
        <p style="color: #9CA3AF; font-size: 12px; margin: 8px 0 0 0;">
          You're receiving this because of an issue with your enhancement request.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`

  return { subject, html }
}