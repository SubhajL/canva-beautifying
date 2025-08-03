export interface EmailRecipient {
  email: string
  name?: string
}

export interface EmailOptions {
  to: EmailRecipient | EmailRecipient[]
  subject: string
  replyTo?: string
  tags?: string[]
  scheduledAt?: Date
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  previewText?: string
}

export interface EmailDeliveryResult {
  id: string
  success: boolean
  error?: string
}

export interface EmailPreferences {
  userId: string
  enhancementCompleted: boolean
  marketingEmails: boolean
  weeklyDigest: boolean
  systemNotifications: boolean
  updatedAt: Date
}

export type EmailTemplateType = 
  | 'enhancement-completed'
  | 'welcome'
  | 'password-reset'
  | 'subscription-created'
  | 'subscription-cancelled'
  | 'subscription-renewed'
  | 'usage-limit-warning'
  | 'weekly-digest'