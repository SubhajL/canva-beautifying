#!/usr/bin/env tsx
/**
 * End-to-End Test Script for Canva Beautifying
 * 
 * This script tests the complete user journey from signup to enhancement export
 * Run with: npx tsx scripts/e2e-test.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { S3 } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Stripe from 'stripe'
import Redis from 'ioredis'
import { io } from 'socket.io-client'
// Use native fetch in Node.js 18+
import FormData from 'form-data'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') })

// Test configuration
const TEST_CONFIG = {
  testEmail: `test-${Date.now()}@canvabeautifying.com`,
  testPassword: 'TestPassword123!',
  testDocument: path.join(__dirname, 'test-assets', 'sample-worksheet.png'),
  timeouts: {
    auth: 10000,
    upload: 30000,
    enhancement: 60000,
    websocket: 5000
  }
}

// Test results
const results: { [key: string]: { status: 'pass' | 'fail'; message?: string; duration?: number } } = {}

// Utilities
function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m'
  }
  console.log(`${colors[type]}${message}\x1b[0m`)
}

async function runTest(name: string, testFn: () => Promise<void>) {
  const startTime = Date.now()
  try {
    log(`\nTesting: ${name}...`, 'info')
    await testFn()
    results[name] = { 
      status: 'pass', 
      duration: Date.now() - startTime 
    }
    log(`✓ ${name} passed`, 'success')
  } catch (error) {
    results[name] = { 
      status: 'fail', 
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    }
    log(`✗ ${name} failed: ${results[name].message}`, 'error')
  }
}

// Test Functions
async function testSupabaseConnection() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  
  // Test database connection
  const { error: dbError } = await supabase.from('documents').select('count').limit(1)
  if (dbError) throw new Error(`Database connection failed: ${dbError.message}`)
}

async function testR2Connection() {
  const s3Client = new S3({
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
  
  // Test bucket access
  const testKey = `test/connection-${Date.now()}.txt`
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: testKey,
      Body: Buffer.from('R2 connection test'),
    },
  })
  
  await upload.done()
  
  // Clean up
  await s3Client.deleteObject({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: testKey,
  })
}

async function testRedisConnection() {
  const redis = new Redis(process.env.REDIS_URL!)
  
  // Test basic operations
  await redis.set('test:connection', 'success')
  const value = await redis.get('test:connection')
  if (value !== 'success') throw new Error('Redis read/write failed')
  
  await redis.del('test:connection')
  await redis.quit()
}

async function testAIModels() {
  // Test OpenAI
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const openaiResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Test' }],
    max_tokens: 10
  })
  if (!openaiResponse.choices[0].message.content) throw new Error('OpenAI test failed')
  
  // Test Anthropic
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const anthropicResponse = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'Test' }],
    max_tokens: 10
  })
  if (!anthropicResponse.content[0].text) throw new Error('Anthropic test failed')
  
  // Test Google Gemini
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
  const geminiResponse = await model.generateContent('Test')
  if (!geminiResponse.response.text()) throw new Error('Gemini test failed')
}

async function testStripeConnection() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia'
  })
  
  // Test connection by listing products
  const products = await stripe.products.list({ limit: 1 })
  if (!products) throw new Error('Stripe connection failed')
}

async function testWebSocketConnection() {
  return new Promise<void>((resolve, reject) => {
    const socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL!, {
      transports: ['websocket'],
      timeout: TEST_CONFIG.timeouts.websocket
    })
    
    socket.on('connect', () => {
      socket.disconnect()
      resolve()
    })
    
    socket.on('connect_error', (error) => {
      reject(new Error(`WebSocket connection failed: ${error.message}`))
    })
    
    setTimeout(() => {
      socket.disconnect()
      reject(new Error('WebSocket connection timeout'))
    }, TEST_CONFIG.timeouts.websocket)
  })
}

async function testUserFlow() {
  // 1. Sign up
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_CONFIG.testEmail,
    password: TEST_CONFIG.testPassword,
  })
  
  if (signUpError) throw new Error(`Signup failed: ${signUpError.message}`)
  if (!authData.user) throw new Error('No user returned from signup')
  
  const userId = authData.user.id
  const accessToken = authData.session?.access_token
  
  // 2. Create test document
  const formData = new FormData()
  
  // Create a simple test image if it doesn't exist
  const testImagePath = TEST_CONFIG.testDocument
  try {
    await fs.access(testImagePath)
  } catch {
    // Create test directory and image
    await fs.mkdir(path.dirname(testImagePath), { recursive: true })
    
    // Create a simple PNG using canvas
    const { createCanvas } = await import('canvas')
    const canvas = createCanvas(800, 600)
    const ctx = canvas.getContext('2d')
    
    // Draw test content
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(0, 0, 800, 600)
    ctx.fillStyle = '#333'
    ctx.font = '48px Arial'
    ctx.fillText('Test Worksheet', 200, 300)
    
    const buffer = canvas.toBuffer('image/png')
    await fs.writeFile(testImagePath, buffer)
  }
  
  const fileBuffer = await fs.readFile(testImagePath)
  formData.append('file', fileBuffer, 'test-worksheet.png')
  
  // 3. Upload document via API
  const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/enhance/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData
  })
  
  if (!uploadResponse.ok) {
    const error = await uploadResponse.text()
    throw new Error(`Upload failed: ${error}`)
  }
  
  const uploadData = await uploadResponse.json()
  const documentId = uploadData.data.documentId
  
  // 4. Start enhancement
  const enhanceResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/enhance/process`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      documentId,
      settings: {
        style: 'modern',
        colorScheme: 'vibrant',
        targetAudience: 'elementary'
      }
    })
  })
  
  if (!enhanceResponse.ok) {
    const error = await enhanceResponse.text()
    throw new Error(`Enhancement start failed: ${error}`)
  }
  
  const enhanceData = await enhanceResponse.json()
  const enhancementId = enhanceData.data.enhancementId
  
  // 5. Poll for completion
  let attempts = 0
  const maxAttempts = 30
  let completed = false
  
  while (attempts < maxAttempts && !completed) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const statusResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/enhance/status/${enhancementId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )
    
    if (!statusResponse.ok) {
      throw new Error('Status check failed')
    }
    
    const statusData = await statusResponse.json()
    
    if (statusData.data.status === 'completed') {
      completed = true
    } else if (statusData.data.status === 'failed') {
      throw new Error(`Enhancement failed: ${statusData.data.error}`)
    }
    
    attempts++
  }
  
  if (!completed) {
    throw new Error('Enhancement timeout')
  }
  
  // 6. Get results
  const resultResponse = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/enhance/result/${enhancementId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  )
  
  if (!resultResponse.ok) {
    throw new Error('Failed to get results')
  }
  
  const resultData = await resultResponse.json()
  
  // Verify enhancement was successful
  if (!resultData.data.enhancedFileUrl) {
    throw new Error('No enhanced file URL returned')
  }
  
  if (!resultData.data.improvements || resultData.data.improvements.overallScore.after <= resultData.data.improvements.overallScore.before) {
    throw new Error('No improvement detected')
  }
  
  // Clean up - delete test user
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
  if (deleteError) {
    log(`Warning: Failed to clean up test user: ${deleteError.message}`, 'error')
  }
}

// Main test runner
async function runAllTests() {
  log('\n🚀 Starting End-to-End Tests for Canva Beautifying\n', 'info')
  
  // Infrastructure tests
  await runTest('Supabase Connection', testSupabaseConnection)
  await runTest('R2 Storage Connection', testR2Connection)
  await runTest('Redis Connection', testRedisConnection)
  await runTest('AI Models', testAIModels)
  await runTest('Stripe Connection', testStripeConnection)
  await runTest('WebSocket Connection', testWebSocketConnection)
  
  // User flow test
  await runTest('Complete User Flow', testUserFlow)
  
  // Summary
  log('\n📊 Test Results Summary\n', 'info')
  
  let passed = 0
  let failed = 0
  
  for (const [name, result] of Object.entries(results)) {
    if (result.status === 'pass') {
      passed++
      log(`✓ ${name} (${result.duration}ms)`, 'success')
    } else {
      failed++
      log(`✗ ${name}: ${result.message} (${result.duration}ms)`, 'error')
    }
  }
  
  log(`\n📈 Total: ${passed + failed} tests, ${passed} passed, ${failed} failed`, 'info')
  
  if (failed > 0) {
    log('\n❌ Some tests failed. Please check the errors above.', 'error')
    process.exit(1)
  } else {
    log('\n✅ All tests passed! The system is ready for soft launch.', 'success')
    process.exit(0)
  }
}

// Run tests
runAllTests().catch((error) => {
  log(`\n💥 Fatal error: ${error.message}`, 'error')
  process.exit(1)
})