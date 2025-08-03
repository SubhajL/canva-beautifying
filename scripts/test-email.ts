#!/usr/bin/env tsx
/**
 * Test Resend email configuration
 * Run: npx tsx scripts/test-email.ts
 */

import { config } from 'dotenv'
import { Resend } from 'resend'

// Load environment variables
config({ path: '.env.local' })

async function testEmail() {
  console.log('📧 Testing Resend email configuration...\n')

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    console.log('Sending test email to:', process.env.TEST_EMAIL)
    console.log('From:', process.env.RESEND_FROM_EMAIL)
    console.log('Reply-To:', process.env.RESEND_REPLY_TO_EMAIL)

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.TEST_EMAIL!,
      replyTo: process.env.RESEND_REPLY_TO_EMAIL,
      subject: 'BeautifyAI - Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #7C3AED;">✅ Email Configuration Successful!</h1>
          <p>Your Resend email service is properly configured for BeautifyAI.</p>
          <hr style="border: 1px solid #E5E7EB; margin: 20px 0;">
          <p style="color: #6B7280; font-size: 14px;">
            This is a test email from your BeautifyAI application.
            If you received this, your email configuration is working correctly.
          </p>
          <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <h3 style="margin-top: 0;">Configuration Details:</h3>
            <ul style="color: #374151;">
              <li>API Key: ${process.env.RESEND_API_KEY?.substring(0, 10)}...</li>
              <li>From: ${process.env.RESEND_FROM_EMAIL}</li>
              <li>Reply-To: ${process.env.RESEND_REPLY_TO_EMAIL}</li>
            </ul>
          </div>
        </div>
      `,
    })

    if (error) {
      throw new Error(error.message)
    }

    console.log('\n✅ Email sent successfully!')
    console.log('Email ID:', data?.id)
    console.log('\nCheck your inbox at:', process.env.TEST_EMAIL)

  } catch (error) {
    console.error('\n❌ Email test failed!')
    console.error('Error:', error instanceof Error ? error.message : error)
    
    console.log('\n📋 Troubleshooting:')
    console.log('1. Check your RESEND_API_KEY is correct')
    console.log('2. Verify your domain in Resend dashboard (or use onboarding@resend.dev)')
    console.log('3. Make sure RESEND_FROM_EMAIL uses a verified domain')
    console.log('4. Check that TEST_EMAIL is a valid email address')
    
    process.exit(1)
  }
}

// Run the test
testEmail()