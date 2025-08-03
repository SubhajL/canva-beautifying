#!/usr/bin/env tsx

import { render } from '@react-email/render'
import fs from 'fs/promises'
import path from 'path'

// Import email templates
import EnhancementCompletedEmail from '../lib/email/templates/enhancement-completed'
import WelcomeEmail from '../lib/email/templates/welcome'
import PasswordResetEmail from '../lib/email/templates/password-reset'
import SubscriptionCreatedEmail from '../lib/email/templates/subscription-created'

const outputDir = path.join(process.cwd(), 'email-previews')

async function generateEmailPreviews() {
  // Create output directory
  await fs.mkdir(outputDir, { recursive: true })

  console.log('🎨 Generating email template previews...\n')

  // Enhancement Completed Email
  const enhancementHtml = render(
    EnhancementCompletedEmail({
      userName: 'John Doe',
      documentName: 'Q4 Marketing Presentation',
      enhancementUrl: 'https://beautifyai.com/download/abc123',
      originalPreviewUrl: 'https://beautifyai.com/preview/original.jpg',
      enhancedPreviewUrl: 'https://beautifyai.com/preview/enhanced.jpg',
      processingTime: 23,
      improvementScore: 87,
    })
  )
  await fs.writeFile(
    path.join(outputDir, 'enhancement-completed.html'),
    enhancementHtml
  )
  console.log('✅ Generated: enhancement-completed.html')

  // Welcome Email
  const welcomeHtml = render(
    WelcomeEmail({
      userName: 'Jane Smith',
      userTier: 'pro',
      monthlyCredits: 500,
    })
  )
  await fs.writeFile(
    path.join(outputDir, 'welcome.html'),
    welcomeHtml
  )
  console.log('✅ Generated: welcome.html')

  // Password Reset Email
  const passwordResetHtml = render(
    PasswordResetEmail({
      userName: 'John Doe',
      resetUrl: 'https://beautifyai.com/reset-password?token=abc123def456',
      userEmail: 'john@example.com',
      ipAddress: '192.168.1.1',
      userAgent: 'Chrome/120.0.0.0 Safari/537.36',
    })
  )
  await fs.writeFile(
    path.join(outputDir, 'password-reset.html'),
    passwordResetHtml
  )
  console.log('✅ Generated: password-reset.html')

  // Subscription Created Email
  const subscriptionHtml = render(
    SubscriptionCreatedEmail({
      userName: 'Sarah Johnson',
      planName: 'Premium',
      monthlyCredits: 2000,
      amount: 49,
      billingCycle: 'monthly',
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      invoiceUrl: 'https://beautifyai.com/invoices/inv_123456',
    })
  )
  await fs.writeFile(
    path.join(outputDir, 'subscription-created.html'),
    subscriptionHtml
  )
  console.log('✅ Generated: subscription-created.html')

  console.log(`\n📁 Email previews saved to: ${outputDir}`)
  console.log('💡 Open the HTML files in your browser to preview the emails')
}

// Test email sending (requires RESEND_API_KEY)
async function testEmailSending() {
  if (!process.env.RESEND_API_KEY) {
    console.log('\n⚠️  RESEND_API_KEY not set. Skipping email sending test.')
    return
  }

  console.log('\n📧 Testing email sending...\n')

  const { EmailService } = await import('../lib/email/email-service')
  
  // Test with a real email address
  const testEmail = process.env.TEST_EMAIL || 'test@example.com'
  
  const result = await EmailService.sendWelcomeEmail('test-user-id', {
    userName: 'Test User',
    userEmail: testEmail,
    userTier: 'free',
    monthlyCredits: 10,
  })

  if (result.success) {
    console.log(`✅ Test email sent successfully! ID: ${result.id}`)
  } else {
    console.log(`❌ Failed to send test email: ${result.error}`)
  }
}

// Run tests
async function main() {
  try {
    await generateEmailPreviews()
    await testEmailSending()
  } catch (error) {
    console.error('Error running email tests:', error)
    process.exit(1)
  }
}

main()