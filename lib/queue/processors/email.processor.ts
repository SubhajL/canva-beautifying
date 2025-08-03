import { Worker, Job } from 'bullmq'
import { getQueueConnection, QUEUE_NAMES } from '../config'
import type { EmailJobData, JobResult } from '../types'
import { Resend } from 'resend'

// Initialize Resend client (you'll need to add RESEND_API_KEY to env)
const resend = new Resend(process.env.RESEND_API_KEY)

// Email templates
interface EmailTemplateData {
  userName?: string
  documentTitle?: string
  qualityImprovement?: number
  viewUrl?: string
  exportFormat?: string
  downloadUrl?: string
  errorMessage?: string
  dashboardUrl?: string
}

const emailTemplates = {
  'enhancement-complete': (data: EmailTemplateData) => ({
    subject: 'Your document enhancement is complete!',
    html: `
      <h2>Hi ${data.userName},</h2>
      <p>Great news! Your document "${data.documentTitle}" has been enhanced and is ready for download.</p>
      <p><strong>Improvements made:</strong></p>
      <ul>
        <li>Color palette optimization</li>
        <li>Typography enhancement</li>
        <li>Layout restructuring</li>
        <li>Visual element additions</li>
      </ul>
      <p>Quality improvement score: <strong>${data.qualityImprovement}%</strong></p>
      <p><a href="${data.viewUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Enhanced Document</a></p>
      <p>Best regards,<br>The Canva Beautifying Team</p>
    `,
  }),
  
  'export-ready': (data: EmailTemplateData) => ({
    subject: `Your ${data.exportFormat} export is ready!`,
    html: `
      <h2>Hi ${data.userName},</h2>
      <p>Your document "${data.documentTitle}" has been successfully exported as ${data.exportFormat}.</p>
      <p><a href="${data.downloadUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Download ${data.exportFormat}</a></p>
      <p>This download link will expire in 7 days.</p>
      <p>Best regards,<br>The Canva Beautifying Team</p>
    `,
  }),
  
  'error-notification': (data: EmailTemplateData) => ({
    subject: 'Issue with your document processing',
    html: `
      <h2>Hi ${data.userName},</h2>
      <p>We encountered an issue while processing your document "${data.documentTitle}".</p>
      <p><strong>Error:</strong> ${data.errorMessage}</p>
      <p>Our team has been notified and is looking into this issue. Please try uploading your document again, or contact our support team if the problem persists.</p>
      <p>We apologize for the inconvenience.</p>
      <p>Best regards,<br>The Canva Beautifying Team</p>
    `,
  }),
  
  'welcome': (data: EmailTemplateData) => ({
    subject: 'Welcome to Canva Beautifying!',
    html: `
      <h2>Welcome ${data.userName}!</h2>
      <p>Thank you for joining Canva Beautifying. We're excited to help you transform your documents with AI-powered enhancements.</p>
      <p><strong>What you can do:</strong></p>
      <ul>
        <li>Upload any visual document (PDF, PNG, JPG)</li>
        <li>Get AI-powered design suggestions</li>
        <li>Enhance colors, typography, and layout automatically</li>
        <li>Export in multiple formats</li>
      </ul>
      <p><a href="${data.dashboardUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a></p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Best regards,<br>The Canva Beautifying Team</p>
    `,
  }),
}

export const createEmailWorker = () => {
  const worker = new Worker<EmailJobData, JobResult>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
      const { to, subject: customSubject, template, data } = job.data

      try {
        // Get email template
        const emailTemplate = emailTemplates[template]
        if (!emailTemplate) {
          throw new Error(`Unknown email template: ${template}`)
        }

        const { subject, html } = emailTemplate(data)

        // Send email using Resend
        const { data: emailData, error } = await resend.emails.send({
          from: 'Canva Beautifying <noreply@canvabeautifying.com>',
          to,
          subject: customSubject || subject,
          html,
        })

        if (error) {
          throw error
        }

        return {
          success: true,
          data: {
            emailId: emailData?.id,
            template,
            sentTo: to,
          },
        }
      } catch (error) {
        console.error('Email sending error:', error)
        
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Failed to send email',
            code: 'EMAIL_ERROR',
            details: error,
          },
        }
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 10, // Process up to 10 email jobs concurrently
      limiter: {
        max: 100,
        duration: 60000, // Max 100 emails per minute
      },
    }
  )

  // Error handling
  worker.on('failed', (job, err) => {
    console.error(`Email job ${job?.id} failed:`, err)
  })

  worker.on('completed', (job) => {
    console.log(`Email job ${job.id} completed`)
  })

  return worker
}