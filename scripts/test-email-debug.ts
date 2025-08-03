#!/usr/bin/env tsx
/**
 * Test Resend email configuration with debugging
 * Run: npx tsx scripts/test-email-debug.ts
 */

import { config } from 'dotenv'
import { Resend } from 'resend'
import path from 'path'
import fs from 'fs'

// Debug: Show current directory
console.log('Current directory:', process.cwd())

// Debug: Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local')
console.log('Looking for .env.local at:', envPath)
console.log('File exists:', fs.existsSync(envPath))

// Load environment variables with debugging
const result = config({ path: '.env.local' })
console.log('Dotenv result:', result)

// Debug: Show loaded env vars
console.log('\nEnvironment variables check:')
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Found (length: ' + process.env.RESEND_API_KEY.length + ')' : 'NOT FOUND')
console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || 'NOT FOUND')
console.log('RESEND_REPLY_TO_EMAIL:', process.env.RESEND_REPLY_TO_EMAIL || 'NOT FOUND')
console.log('TEST_EMAIL:', process.env.TEST_EMAIL || 'NOT FOUND')

// Also check if it's reading .env instead of .env.local
console.log('\nChecking other possible sources:')
console.log('NODE_ENV:', process.env.NODE_ENV)

async function testEmail() {
  console.log('\n📧 Testing Resend email configuration...\n')

  if (!process.env.RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY not found in environment variables!')
    process.exit(1)
  }

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