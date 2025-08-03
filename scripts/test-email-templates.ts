#!/usr/bin/env tsx
/**
 * Test and preview all email templates
 * Run: npx tsx scripts/test-email-templates.ts
 */

import { config } from 'dotenv'
import { Resend } from 'resend'
import {
  welcomeEmailTemplate,
  enhancementCompleteEmailTemplate,
  subscriptionEmailTemplate,
  betaFeedbackEmailTemplate,
  errorNotificationEmailTemplate
} from '../lib/email/templates'

// Load environment variables
config({ path: '.env.local' })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// Sample data for testing
const sampleData = {
  welcome: {
    userName: 'John',
    subscriptionTier: 'pro' as const,
    appUrl: APP_URL
  },
  enhancementComplete: {
    userName: 'John',
    documentName: 'Math Worksheet - Grade 5',
    enhancementId: 'enh_abc123',
    improvements: { before: 45, after: 87 },
    processingTime: '2 minutes 34 seconds',
    downloadUrl: `${APP_URL}/api/download/enh_abc123`,
    appUrl: APP_URL
  },
  subscription: {
    userName: 'John',
    action: 'upgraded' as const,
    planName: 'Pro' as const,
    previousPlanName: 'Basic',
    amount: '$24.99',
    interval: 'month' as const,
    nextBillingDate: 'February 20, 2024',
    features: [
      '200 enhancements per month',
      'All AI models including GPT-4',
      'Batch processing up to 10 files',
      'API access with 1000 calls/month',
      'Priority support'
    ],
    appUrl: APP_URL
  },
  betaFeedback: {
    userName: 'John',
    daysInBeta: 14,
    enhancementsCount: 23,
    topFeature: 'Color Enhancement',
    surveyUrl: `${APP_URL}/beta-survey`,
    appUrl: APP_URL
  },
  error: {
    userName: 'John',
    documentName: 'Science Project.pdf',
    enhancementId: 'enh_xyz789',
    errorType: 'ai_failure' as const,
    errorDetails: 'Model timeout after 300 seconds',
    attemptNumber: 2,
    willRetry: true,
    appUrl: APP_URL
  }
}

async function testEmailTemplates() {
  console.log('📧 Testing Email Templates...\n')

  const resend = new Resend(process.env.RESEND_API_KEY)

  // Test which template to send
  const templateToTest = process.argv[2] || 'all'
  
  const templates = {
    welcome: () => welcomeEmailTemplate(sampleData.welcome),
    enhancement: () => enhancementCompleteEmailTemplate(sampleData.enhancementComplete),
    subscription: () => subscriptionEmailTemplate(sampleData.subscription),
    beta: () => betaFeedbackEmailTemplate(sampleData.betaFeedback),
    error: () => errorNotificationEmailTemplate(sampleData.error)
  }

  try {
    if (templateToTest === 'all') {
      console.log('Sending all 5 email templates to:', process.env.TEST_EMAIL)
      console.log('This will send 5 separate emails...\n')

      for (const [name, getTemplate] of Object.entries(templates)) {
        const { subject, html } = getTemplate()
        
        console.log(`Sending ${name} email...`)
        const { data, error } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: process.env.TEST_EMAIL!,
          replyTo: process.env.RESEND_REPLY_TO_EMAIL,
          subject: `[TEST] ${subject}`,
          html
        })

        if (error) {
          console.error(`❌ Failed to send ${name}:`, error.message)
        } else {
          console.log(`✅ Sent ${name} email (ID: ${data?.id})`)
        }

        // Wait a bit between emails
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    } else if (templateToTest in templates) {
      const { subject, html } = templates[templateToTest as keyof typeof templates]()
      
      console.log(`Sending ${templateToTest} email to:`, process.env.TEST_EMAIL)
      
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: process.env.TEST_EMAIL!,
        replyTo: process.env.RESEND_REPLY_TO_EMAIL,
        subject: `[TEST] ${subject}`,
        html
      })

      if (error) {
        throw new Error(error.message)
      }

      console.log(`\n✅ Email sent successfully!`)
      console.log(`Email ID: ${data?.id}`)
    } else {
      console.error(`Unknown template: ${templateToTest}`)
      console.log('\nAvailable templates:')
      console.log('- welcome')
      console.log('- enhancement')
      console.log('- subscription')
      console.log('- beta')
      console.log('- error')
      console.log('- all (sends all templates)')
      process.exit(1)
    }

    console.log('\n📬 Check your inbox!')

  } catch (error) {
    console.error('\n❌ Test failed!')
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Show usage if --help
if (process.argv.includes('--help')) {
  console.log('Usage: npx tsx scripts/test-email-templates.ts [template]')
  console.log('\nTemplates:')
  console.log('  welcome      - Welcome email for new users')
  console.log('  enhancement  - Enhancement complete notification')
  console.log('  subscription - Subscription/billing emails')
  console.log('  beta         - Beta feedback request')
  console.log('  error        - Error notification')
  console.log('  all          - Send all templates (default)')
  console.log('\nExample:')
  console.log('  npx tsx scripts/test-email-templates.ts welcome')
  process.exit(0)
}

// Run the test
testEmailTemplates()