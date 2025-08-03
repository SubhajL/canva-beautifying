export interface BetaFeedbackEmailData {
  userName?: string
  daysInBeta: number
  enhancementsCount: number
  topFeature: string
  surveyUrl: string
  appUrl: string
}

export const betaFeedbackEmailTemplate = (data: BetaFeedbackEmailData): { subject: string; html: string } => {
  const {
    userName = 'Beta Tester',
    daysInBeta,
    enhancementsCount,
    topFeature,
    surveyUrl,
    appUrl
  } = data

  const subject = `🚀 How's your BeautifyAI beta experience going?`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beta Feedback Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F9FAFB;">
  <div style="padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%); padding: 40px 30px; text-align: center;">
        <div style="background-color: white; display: inline-block; padding: 12px 24px; border-radius: 24px; margin-bottom: 16px;">
          <span style="color: #7C3AED; font-weight: bold; font-size: 14px;">BETA PROGRAM</span>
        </div>
        <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">
          We'd Love Your Feedback! 💭
        </h1>
      </div>

      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #1F2937; font-size: 24px; margin-bottom: 16px;">
          Hi ${userName}!
        </h2>
        
        <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          You've been part of our beta program for <strong>${daysInBeta} days</strong> now, 
          and your feedback is invaluable in shaping the future of BeautifyAI!
        </p>

        <!-- Stats Card -->
        <div style="background-color: #EDE9FE; padding: 24px; border-radius: 8px; margin-bottom: 32px;">
          <h3 style="color: #5B21B6; margin: 0 0 16px 0; font-size: 20px;">
            Your Beta Journey So Far 📈
          </h3>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="background-color: white; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="color: #6B7280; font-size: 14px; margin: 0;">Documents Enhanced</p>
              <p style="color: #7C3AED; font-size: 32px; font-weight: bold; margin: 8px 0 0 0;">${enhancementsCount}</p>
            </div>
            <div style="background-color: white; padding: 16px; border-radius: 8px; text-align: center;">
              <p style="color: #6B7280; font-size: 14px; margin: 0;">Most Used Feature</p>
              <p style="color: #7C3AED; font-size: 18px; font-weight: bold; margin: 8px 0 0 0;">${topFeature}</p>
            </div>
          </div>
        </div>

        <!-- Survey Request -->
        <div style="margin-bottom: 32px;">
          <h3 style="color: #1F2937; font-size: 20px; margin-bottom: 16px;">
            Help Us Improve! 🎯
          </h3>
          <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
            We've prepared a short survey (only 5 minutes!) to gather your thoughts on:
          </p>
          <ul style="margin: 0 0 24px 0; padding-left: 20px;">
            <li style="color: #4B5563; margin-bottom: 8px;">What features you love most</li>
            <li style="color: #4B5563; margin-bottom: 8px;">What could be improved</li>
            <li style="color: #4B5563; margin-bottom: 8px;">Features you'd like to see next</li>
            <li style="color: #4B5563; margin-bottom: 8px;">Your overall experience</li>
          </ul>
        </div>

        <!-- CTA Button -->
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${surveyUrl}" 
             style="display: inline-block; background-color: #7C3AED; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Take the Survey
          </a>
          <p style="color: #6B7280; font-size: 14px; margin: 12px 0 0 0;">
            🎁 Complete the survey to get <strong>20 bonus enhancements</strong>!
          </p>
        </div>

        <!-- Quick Feedback Options -->
        <div style="background-color: #F3F4F6; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
          <p style="color: #4B5563; font-size: 16px; margin: 0 0 16px 0;">
            <strong>No time for the survey?</strong> Quick feedback:
          </p>
          <div style="text-align: center;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 12px 0;">
              How likely are you to recommend BeautifyAI?
            </p>
            <div style="display: inline-flex; gap: 8px;">
              ${[1,2,3,4,5,6,7,8,9,10].map(score => `
                <a href="${appUrl}/quick-feedback?score=${score}" 
                   style="display: inline-block; background-color: ${score >= 9 ? '#10B981' : score >= 7 ? '#F59E0B' : '#EF4444'}; 
                          color: white; width: 32px; height: 32px; line-height: 32px; text-align: center; 
                          border-radius: 4px; text-decoration: none; font-size: 14px;">
                  ${score}
                </a>
              `).join('')}
            </div>
            <p style="color: #9CA3AF; font-size: 12px; margin: 8px 0 0 0;">
              Not likely ← → Very likely
            </p>
          </div>
        </div>

        <!-- Beta Benefits Reminder -->
        <div style="border: 1px solid #E5E7EB; padding: 20px; border-radius: 8px;">
          <h4 style="color: #1F2937; margin: 0 0 12px 0; font-size: 16px;">
            🌟 Your Beta Benefits
          </h4>
          <ul style="margin: 0; padding-left: 20px; color: #4B5563; font-size: 14px;">
            <li style="margin-bottom: 6px;">50% lifetime discount when we launch</li>
            <li style="margin-bottom: 6px;">Early access to new features</li>
            <li style="margin-bottom: 6px;">Direct line to the founding team</li>
            <li style="margin-bottom: 6px;">Your name in our beta contributors list</li>
          </ul>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #F9FAFB; padding: 24px 30px; text-align: center;">
        <p style="color: #6B7280; font-size: 14px; margin: 0 0 8px 0;">
          Thank you for being part of our journey! 💜
        </p>
        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
          © 2024 BeautifyAI. All rights reserved.
        </p>
        <p style="color: #9CA3AF; font-size: 12px; margin: 8px 0 0 0;">
          You're receiving this as a BeautifyAI beta tester.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`

  return { subject, html }
}