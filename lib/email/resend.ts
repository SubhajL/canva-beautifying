import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY not found. Email functionality will be disabled.')
}

export const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'BeautifyAI <noreply@beautifyai.com>'
export const REPLY_TO_EMAIL = process.env.RESEND_REPLY_TO_EMAIL || 'support@beautifyai.com'