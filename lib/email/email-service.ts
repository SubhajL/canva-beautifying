import { render } from '@react-email/render'
import { resend, FROM_EMAIL, REPLY_TO_EMAIL } from './resend'
import { 
  EmailDeliveryResult, 
  EmailTemplateType,
  EmailRecipient 
} from './types'
import { createClient } from '@/lib/supabase/client'

// Import email templates
import EnhancementCompletedEmail from './templates/enhancement-completed'
import WelcomeEmail from './templates/welcome'
import PasswordResetEmail from './templates/password-reset'
import SubscriptionCreatedEmail from './templates/subscription-created'

export class EmailService {
  private static async checkEmailPreferences(
    userId: string,
    emailType: EmailTemplateType
  ): Promise<boolean> {
    // Map email types to preference fields
    const preferenceMap: Record<EmailTemplateType, string> = {
      'enhancement-completed': 'enhancement_completed',
      'welcome': 'system_notifications',
      'password-reset': 'system_notifications',
      'subscription-created': 'system_notifications',
      'subscription-cancelled': 'system_notifications',
      'subscription-renewed': 'system_notifications',
      'usage-limit-warning': 'system_notifications',
      'weekly-digest': 'weekly_digest',
    }

    const preferenceField = preferenceMap[emailType]
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('email_preferences')
      .select(preferenceField)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // Default to true if no preferences found
      return true
    }

    return (data as any)[preferenceField] ?? true
  }

  private static async logEmailDelivery(
    userId: string,
    emailType: EmailTemplateType,
    recipient: string,
    success: boolean,
    messageId?: string,
    error?: string
  ): Promise<void> {
    const supabase = createClient()
    await supabase.from('email_logs').insert({
      user_id: userId,
      email_type: emailType,
      recipient,
      success,
      message_id: messageId,
      error,
      sent_at: new Date().toISOString(),
    })
  }

  static async sendEnhancementCompletedEmail(
    userId: string,
    data: {
      userName: string
      userEmail: string
      documentName: string
      enhancementUrl: string
      originalPreviewUrl?: string
      enhancedPreviewUrl?: string
      processingTime: number
      improvementScore: number
    }
  ): Promise<EmailDeliveryResult> {
    // Check preferences
    const canSend = await this.checkEmailPreferences(userId, 'enhancement-completed')
    if (!canSend) {
      return { id: '', success: true } // Silently skip
    }

    if (!resend) {
      console.log('Email service not configured. Would send enhancement completed email to:', data.userEmail)
      return { id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, success: true }
    }

    try {
      const html = await render(EnhancementCompletedEmail(data))
      
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: data.userEmail,
        subject: `Your enhanced document "${data.documentName}" is ready!`,
        html,
        replyTo: REPLY_TO_EMAIL,
        tags: [
          { name: 'type', value: 'enhancement-completed' },
          { name: 'user_id', value: userId },
        ],
      })

      await this.logEmailDelivery(
        userId,
        'enhancement-completed',
        data.userEmail,
        true,
        (result as any).data?.id || (result as any).id
      )

      return { id: (result as any).data?.id || (result as any).id || '', success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      await this.logEmailDelivery(
        userId,
        'enhancement-completed',
        data.userEmail,
        false,
        undefined,
        errorMessage
      )

      return { id: '', success: false, error: errorMessage }
    }
  }

  static async sendWelcomeEmail(
    userId: string,
    data: {
      userName: string
      userEmail: string
      userTier: 'free' | 'basic' | 'pro' | 'premium'
      monthlyCredits: number
    }
  ): Promise<EmailDeliveryResult> {
    if (!resend) {
      console.log('Email service not configured. Would send welcome email to:', data.userEmail)
      return { id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, success: true }
    }

    try {
      const html = await render(WelcomeEmail(data))
      
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: data.userEmail,
        subject: 'Welcome to BeautifyAI! 🎨',
        html,
        replyTo: REPLY_TO_EMAIL,
        tags: [
          { name: 'type', value: 'welcome' },
          { name: 'user_id', value: userId },
          { name: 'tier', value: data.userTier },
        ],
      })

      await this.logEmailDelivery(userId, 'welcome', data.userEmail, true, (result as any).data?.id || (result as any).id)

      return { id: (result as any).data?.id || (result as any).id || '', success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      await this.logEmailDelivery(
        userId,
        'welcome',
        data.userEmail,
        false,
        undefined,
        errorMessage
      )

      return { id: '', success: false, error: errorMessage }
    }
  }

  static async sendPasswordResetEmail(
    data: {
      userName: string
      userEmail: string
      resetUrl: string
      ipAddress?: string
      userAgent?: string
    }
  ): Promise<EmailDeliveryResult> {
    if (!resend) {
      console.log('Email service not configured. Would send password reset email to:', data.userEmail)
      return { id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, success: true }
    }

    try {
      const html = await render(PasswordResetEmail(data))
      
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: data.userEmail,
        subject: 'Reset your BeautifyAI password',
        html,
        replyTo: REPLY_TO_EMAIL,
        tags: [
          { name: 'type', value: 'password-reset' },
        ],
      })

      // Log without userId since user might not be authenticated
      const supabase = createClient()
      await supabase.from('email_logs').insert({
        email_type: 'password-reset',
        recipient: data.userEmail,
        success: true,
        message_id: (result as any).data?.id || (result as any).id,
        sent_at: new Date().toISOString(),
      })

      return { id: (result as any).data?.id || (result as any).id || '', success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      const supabase = createClient()
      await supabase.from('email_logs').insert({
        email_type: 'password-reset',
        recipient: data.userEmail,
        success: false,
        error: errorMessage,
        sent_at: new Date().toISOString(),
      })

      return { id: '', success: false, error: errorMessage }
    }
  }

  static async sendSubscriptionCreatedEmail(
    userId: string,
    data: {
      userName: string
      userEmail: string
      planName: 'Basic' | 'Pro' | 'Premium'
      monthlyCredits: number
      amount: number
      billingCycle: 'monthly' | 'yearly'
      nextBillingDate: Date
      invoiceUrl?: string
    }
  ): Promise<EmailDeliveryResult> {
    const canSend = await this.checkEmailPreferences(userId, 'subscription-created')
    if (!canSend) {
      return { id: '', success: true }
    }

    if (!resend) {
      console.log('Email service not configured. Would send subscription created email to:', data.userEmail)
      return { id: `dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, success: true }
    }

    try {
      const html = await render(SubscriptionCreatedEmail(data))
      
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: data.userEmail,
        subject: `Welcome to BeautifyAI ${data.planName}!`,
        html,
        replyTo: REPLY_TO_EMAIL,
        tags: [
          { name: 'type', value: 'subscription-created' },
          { name: 'user_id', value: userId },
          { name: 'plan', value: data.planName },
        ],
      })

      await this.logEmailDelivery(
        userId,
        'subscription-created',
        data.userEmail,
        true,
        (result as any).data?.id || (result as any).id
      )

      return { id: (result as any).data?.id || (result as any).id || '', success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      await this.logEmailDelivery(
        userId,
        'subscription-created',
        data.userEmail,
        false,
        undefined,
        errorMessage
      )

      return { id: '', success: false, error: errorMessage }
    }
  }

  static async sendBulkEmail(
    recipients: EmailRecipient[],
    emailType: EmailTemplateType,
    getEmailData: (recipient: EmailRecipient) => Promise<any>
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0
    let failed = 0

    // Process in batches to avoid rate limits
    const batchSize = 10
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (recipient) => {
          try {
            const data = await getEmailData(recipient)
            let result: EmailDeliveryResult

            switch (emailType) {
              case 'enhancement-completed':
                result = await this.sendEnhancementCompletedEmail('bulk', {
                  ...data,
                  userEmail: recipient.email,
                })
                break
              // Add other email types as needed
              default:
                throw new Error(`Bulk email not implemented for type: ${emailType}`)
            }

            if (result.success) {
              sent++
            } else {
              failed++
            }
          } catch (error) {
            console.error(`Failed to send email to ${recipient.email}:`, error)
            failed++
          }
        })
      )

      // Add delay between batches to respect rate limits
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return { sent, failed }
  }
}