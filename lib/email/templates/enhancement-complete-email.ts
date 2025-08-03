export interface EnhancementCompleteEmailData {
  userName?: string
  documentName: string
  enhancementId: string
  improvements: {
    before: number
    after: number
  }
  processingTime: string
  downloadUrl: string
  appUrl: string
}

export const enhancementCompleteEmailTemplate = (data: EnhancementCompleteEmailData): { subject: string; html: string } => {
  const {
    userName = 'there',
    documentName,
    enhancementId,
    improvements,
    processingTime,
    downloadUrl,
    appUrl
  } = data

  const improvementPercentage = Math.round(((improvements.after - improvements.before) / improvements.before) * 100)

  const subject = `✨ Your enhanced document is ready!`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Enhanced Document is Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F9FAFB;">
  <div style="padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #7C3AED 0%, #EC4899 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">
          Your Document is Ready! ✨
        </h1>
      </div>

      <!-- Content -->
      <div style="padding: 40px 30px;">
        <h2 style="color: #1F2937; font-size: 24px; margin-bottom: 16px;">
          Hi ${userName}!
        </h2>
        
        <p style="color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          Great news! We've finished enhancing your document <strong>"${documentName}"</strong> 
          and the results are stunning!
        </p>

        <!-- Results Card -->
        <div style="background-color: #F3F4F6; padding: 24px; border-radius: 8px; margin-bottom: 32px;">
          <h3 style="color: #1F2937; margin: 0 0 16px 0; font-size: 20px;">
            Enhancement Results 📊
          </h3>
          
          <!-- Score Improvement -->
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <div style="flex: 1;">
              <p style="margin: 0; color: #6B7280; font-size: 14px;">Quality Score</p>
              <div style="display: flex; align-items: baseline; gap: 16px; margin-top: 8px;">
                <span style="color: #DC2626; font-size: 24px; font-weight: bold;">${improvements.before}</span>
                <span style="color: #6B7280; font-size: 20px;">→</span>
                <span style="color: #10B981; font-size: 24px; font-weight: bold;">${improvements.after}</span>
                <span style="color: #10B981; font-size: 16px; font-weight: bold;">+${improvementPercentage}%</span>
              </div>
            </div>
          </div>

          <!-- Processing Details -->
          <div style="border-top: 1px solid #E5E7EB; padding-top: 16px;">
            <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 14px;">
              <strong>Processing Time:</strong> ${processingTime}
            </p>
            <p style="margin: 0; color: #6B7280; font-size: 14px;">
              <strong>Enhancement ID:</strong> <code style="background-color: #E5E7EB; padding: 2px 6px; border-radius: 4px;">${enhancementId}</code>
            </p>
          </div>
        </div>

        <!-- Download Button -->
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${downloadUrl}" 
             style="display: inline-block; background-color: #10B981; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: bold;">
            Download Enhanced Document
          </a>
          <p style="color: #6B7280; font-size: 12px; margin: 8px 0 0 0;">
            This link expires in 7 days
          </p>
        </div>

        <!-- Actions -->
        <div style="background-color: #EDE9FE; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h4 style="color: #5B21B6; margin: 0 0 12px 0; font-size: 16px;">
            What's Next?
          </h4>
          <ul style="margin: 0; padding-left: 20px; color: #6B21A8;">
            <li style="margin-bottom: 8px;">
              <a href="${appUrl}/app/results/${enhancementId}" style="color: #7C3AED;">View side-by-side comparison</a>
            </li>
            <li style="margin-bottom: 8px;">
              <a href="${appUrl}/app/results/${enhancementId}/export" style="color: #7C3AED;">Export in different formats</a>
            </li>
            <li style="margin-bottom: 8px;">
              <a href="${appUrl}/app/upload" style="color: #7C3AED;">Enhance another document</a>
            </li>
          </ul>
        </div>

        <!-- Feedback -->
        <div style="border: 1px solid #E5E7EB; padding: 20px; border-radius: 8px; text-align: center;">
          <p style="color: #4B5563; font-size: 16px; margin: 0 0 12px 0;">
            How did we do? Rate your enhancement:
          </p>
          <div style="display: inline-flex; gap: 8px;">
            <a href="${appUrl}/feedback?id=${enhancementId}&rating=1" style="font-size: 24px; text-decoration: none;">😟</a>
            <a href="${appUrl}/feedback?id=${enhancementId}&rating=2" style="font-size: 24px; text-decoration: none;">😐</a>
            <a href="${appUrl}/feedback?id=${enhancementId}&rating=3" style="font-size: 24px; text-decoration: none;">😊</a>
            <a href="${appUrl}/feedback?id=${enhancementId}&rating=4" style="font-size: 24px; text-decoration: none;">😍</a>
            <a href="${appUrl}/feedback?id=${enhancementId}&rating=5" style="font-size: 24px; text-decoration: none;">🤩</a>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #F9FAFB; padding: 24px 30px; text-align: center;">
        <p style="color: #9CA3AF; font-size: 12px; margin: 0;">
          © 2024 BeautifyAI. All rights reserved.
        </p>
        <p style="color: #9CA3AF; font-size: 12px; margin: 8px 0 0 0;">
          You're receiving this because you requested an enhancement.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`

  return { subject, html }
}