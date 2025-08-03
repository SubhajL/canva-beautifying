import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BetaMessage {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  email_subject: string;
  email_template: string;
  send_email?: boolean;
  target_all_beta?: boolean;
  target_user_ids?: string[];
  target_tiers?: string[];
}

interface EmailRecipient {
  id: string;
  email: string;
  name?: string;
}

export class BetaNotificationService {
  /**
   * Send email notifications for a beta message
   */
  static async sendBetaMessageEmails(messageId: string) {
    try {
      // Fetch message details
      const { data: message, error: messageError } = await supabase
        .from('beta_messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (messageError || !message) {
        throw new Error('Message not found');
      }

      if (!message.send_email) {
        console.log('Email sending not enabled for this message');
        return;
      }

      // Get target recipients
      const recipients = await this.getMessageRecipients(message);
      
      // Send emails in batches to avoid rate limits
      const batchSize = 50;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        await this.sendEmailBatch(message, batch);
      }

      console.log(`Sent ${recipients.length} emails for message ${messageId}`);
    } catch (error) {
      console.error('Error sending beta message emails:', error);
      throw error;
    }
  }

  /**
   * Get recipients for a message based on targeting rules
   */
  private static async getMessageRecipients(message: BetaMessage): Promise<EmailRecipient[]> {
    let query = supabase
      .from('users')
      .select('id, email, name')
      .eq('beta_access', true);

    // Apply targeting filters
    if (!message.target_all_beta) {
      if (message.target_user_ids && message.target_user_ids.length > 0) {
        query = query.in('id', message.target_user_ids);
      }
      if (message.target_tiers && message.target_tiers.length > 0) {
        query = query.in('subscription_tier', message.target_tiers);
      }
    }

    const { data: users, error } = await query;
    
    if (error) {
      throw new Error('Failed to fetch recipients');
    }

    return users || [];
  }

  /**
   * Send emails to a batch of recipients
   */
  private static async sendEmailBatch(message: BetaMessage, recipients: EmailRecipient[]) {
    const emailPromises = recipients.map(async (recipient) => {
      try {
        // Replace template variables
        const emailHtml = this.renderEmailTemplate(message, recipient);
        
        // Send email
        const { data, error } = await resend.emails.send({
          from: 'Canva Beautifying Beta <beta@canvabeautifying.com>',
          to: recipient.email,
          subject: message.email_subject,
          html: emailHtml,
          tags: [
            { name: 'message_id', value: message.id },
            { name: 'category', value: message.category },
            { name: 'priority', value: message.priority }
          ]
        });

        // Log email send status
        await supabase
          .from('beta_email_log')
          .upsert({
            message_id: message.id,
            user_id: recipient.id,
            email_status: error ? 'failed' : 'sent',
            error_message: error?.message || null,
            resend_id: data?.id || null
          });

        return { success: !error, recipient: recipient.email };
      } catch (error) {
        console.error(`Failed to send email to ${recipient.email}:`, error);
        
        // Log failure
        await supabase
          .from('beta_email_log')
          .upsert({
            message_id: message.id,
            user_id: recipient.id,
            email_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          });
        
        return { success: false, recipient: recipient.email };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    console.log(`Batch sent: ${successCount}/${recipients.length} successful`);
  }

  /**
   * Render email template with variables
   */
  private static renderEmailTemplate(message: BetaMessage, recipient: EmailRecipient): string {
    let html = message.email_template || this.getDefaultEmailTemplate();
    
    // Replace variables
    html = html.replace(/{{title}}/g, message.title);
    html = html.replace(/{{content}}/g, message.content);
    html = html.replace(/{{name}}/g, recipient.name || 'Beta Tester');
    html = html.replace(/{{category}}/g, message.category.replace('_', ' '));
    html = html.replace(/{{priority}}/g, message.priority);
    
    // Add tracking pixel
    html += `<img src="${process.env.NEXT_PUBLIC_APP_URL}/api/v1/beta/messages/${message.id}/track?user=${recipient.id}" width="1" height="1" />`;
    
    return html;
  }

  /**
   * Default email template
   */
  private static getDefaultEmailTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>{{title}}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              padding: 32px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              margin-bottom: 24px;
              border-bottom: 2px solid #f0f0f0;
              padding-bottom: 16px;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: #1a1a1a;
              margin: 0;
            }
            .category {
              display: inline-block;
              padding: 4px 12px;
              background-color: #e3f2fd;
              color: #1976d2;
              border-radius: 16px;
              font-size: 12px;
              font-weight: 500;
              margin-top: 8px;
            }
            .content {
              margin: 24px 0;
              white-space: pre-wrap;
            }
            .footer {
              margin-top: 32px;
              padding-top: 16px;
              border-top: 1px solid #f0f0f0;
              font-size: 14px;
              color: #666;
              text-align: center;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #1976d2;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 500;
              margin-top: 16px;
            }
            .button:hover {
              background-color: #1565c0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">{{title}}</h1>
              <span class="category">{{category}}</span>
            </div>
            
            <div class="content">
              {{content}}
            </div>
            
            <div style="text-align: center; margin-top: 32px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/app/beta/announcements" class="button">
                View in Beta Portal
              </a>
            </div>
            
            <div class="footer">
              <p>You're receiving this because you're part of the Canva Beautifying Beta Program.</p>
              <p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/app/settings/notifications" style="color: #1976d2;">
                  Manage notification preferences
                </a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Send a test email for a message
   */
  static async sendTestEmail(messageId: string, testEmail: string) {
    try {
      const { data: message, error } = await supabase
        .from('beta_messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (error || !message) {
        throw new Error('Message not found');
      }

      const testRecipient = {
        id: 'test',
        email: testEmail,
        name: 'Test User'
      };

      const html = this.renderEmailTemplate(message, testRecipient);

      const { data, error: sendError } = await resend.emails.send({
        from: 'Canva Beautifying Beta <beta@canvabeautifying.com>',
        to: testEmail,
        subject: `[TEST] ${message.email_subject || message.title}`,
        html
      });

      if (sendError) {
        throw sendError;
      }

      return { success: true, id: data?.id };
    } catch (error) {
      console.error('Error sending test email:', error);
      throw error;
    }
  }
}