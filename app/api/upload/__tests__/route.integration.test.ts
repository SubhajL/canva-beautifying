/**
 * Integration tests for /api/upload endpoint with real services
 *
 * Prerequisites:
 * - Supabase (local or remote) must be running
 * - R2/S3-compatible storage (MinIO or Cloudflare R2) must be accessible
 * - Required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_* or R2_* variables
 */

import { POST } from '../route'
import { createClient } from '@supabase/supabase-js'
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import path from 'path'
import fs from 'fs/promises'

// Mark as integration test
process.env.JEST_INTEGRATION_TEST = 'true'

describe('POST /api/upload (Integration)', () => {
  let testUserId: string
  let testUserEmail: string
  let testUserPassword: string
  let supabaseAdmin: ReturnType<typeof createClient>
  let s3Client: S3Client

  beforeAll(async () => {
    // Verify required env vars
    const required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'CLOUDFLARE_ACCESS_KEY_ID',
      'CLOUDFLARE_SECRET_ACCESS_KEY',
      'CLOUDFLARE_R2_BUCKET_NAME'
    ]

    const missing = required.filter(key => !process.env[key])
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for integration tests: ${missing.join(', ')}\n` +
        'Please set up your test environment. See TESTING.md for details.'
      )
    }

    // Create admin Supabase client for test setup/teardown
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Create S3 client for R2 cleanup
    const endpoint = process.env.R2_ENDPOINT ||
      `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`

    s3Client = new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!
      },
      forcePathStyle: process.env.R2_FORCE_PATH_STYLE === 'true'
    })

    // Create a test user
    testUserEmail = `test-upload-${Date.now()}@example.com`
    testUserPassword = 'Test123!@#SecurePassword'
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testUserEmail,
      password: testUserPassword,
      email_confirm: true
    })

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`)
    }

    testUserId = authData.user.id
  })

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await supabaseAdmin.auth.admin.deleteUser(testUserId)
    }

    // Clean up test files from R2
    try {
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `original/${testUserId}/`
      })

      const listResponse = await s3Client.send(listCommand)

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        for (const object of listResponse.Contents) {
          if (object.Key) {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: bucketName,
              Key: object.Key
            }))
          }
        }
      }
    } catch (error) {
      console.warn('Failed to clean up R2 test files:', error)
    }
  })

  afterEach(async () => {
    // Clean up enhancement records created during tests
    if (testUserId) {
      await supabaseAdmin
        .from('enhancements')
        .delete()
        .eq('user_id', testUserId)
    }
  })

  describe('Authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test'], { type: 'image/jpeg' }), 'test.jpg')

      const request = new Request('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('File validation', () => {
    let authHeaders: Record<string, string>

    beforeEach(async () => {
      // Sign in to get auth token
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: testUserEmail,
        password: testUserPassword
      })

      if (error || !data.session) {
        throw new Error(`Failed to sign in test user: ${error?.message}`)
      }

      authHeaders = {
        'Authorization': `Bearer ${data.session.access_token}`
      }
    })

    it('returns 400 when no file is provided', async () => {
      const formData = new FormData()

      const request = new Request('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No file provided')
    })

    it('returns 400 when file exceeds size limit', async () => {
      // Create a 51MB buffer
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024)
      const formData = new FormData()
      formData.append('file', new Blob([largeBuffer], { type: 'image/jpeg' }), 'large.jpg')

      const request = new Request('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File size exceeds 50MB limit')
    })

    it('returns 400 for invalid file type', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt')

      const request = new Request('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid file type. Only PNG, JPG, and PDF files are allowed')
    })
  })

  describe('Successful upload', () => {
    let authToken: string
    let testImagePath: string

    beforeAll(async () => {
      // Create test image file
      testImagePath = path.join(__dirname, 'test-image.jpg')

      // Create a minimal valid JPEG
      const jpegHeader = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
        0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
        0x00, 0x01, 0x00, 0x00
      ])
      const jpegFooter = Buffer.from([0xFF, 0xD9])
      const filler = Buffer.alloc(1000, 0xFF)

      await fs.writeFile(testImagePath, Buffer.concat([jpegHeader, filler, jpegFooter]))
    })

    afterAll(async () => {
      // Clean up test image
      try {
        await fs.unlink(testImagePath)
      } catch (error) {
        // Ignore if already deleted
      }
    })

    beforeEach(async () => {
      // Sign in to get fresh auth token
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: testUserEmail,
        password: testUserPassword
      })

      if (error || !data.session) {
        throw new Error(`Failed to sign in test user: ${error?.message}`)
      }

      authToken = data.session.access_token
    })

    it('uploads file successfully and returns correct response', async () => {
      const fileBuffer = await fs.readFile(testImagePath)
      const formData = new FormData()
      formData.append('file', new Blob([fileBuffer], { type: 'image/jpeg' }), 'test.jpg')

      const request = new Request('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.key).toBeDefined()
      expect(data.key).toContain(`original/${testUserId}/`)
      expect(data.url).toBeDefined()
      expect(data.filename).toBe('test.jpg')
      expect(data.type).toBe('image/jpeg')
      expect(data.enhancementId).toBeDefined()

      // Verify database record was created
      const { data: enhancement, error } = await supabaseAdmin
        .from('enhancements')
        .select('*')
        .eq('id', data.enhancementId)
        .single()

      expect(error).toBeNull()
      expect(enhancement).toBeDefined()
      expect(enhancement.user_id).toBe(testUserId)
      expect(enhancement.status).toBe('uploaded')
      expect(enhancement.original_url).toBe(data.url)

      // Verify file exists in R2
      const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: data.key
      })

      const listResponse = await s3Client.send(listCommand)
      expect(listResponse.Contents).toBeDefined()
      expect(listResponse.Contents!.length).toBeGreaterThan(0)
    })

    it('handles special characters in filename', async () => {
      const fileBuffer = await fs.readFile(testImagePath)
      const specialFilename = 'test file (2024) - version 1.0.jpg'
      const formData = new FormData()
      formData.append('file', new Blob([fileBuffer], { type: 'image/jpeg' }), specialFilename)

      const request = new Request('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.filename).toBe(specialFilename)
    })

    it('uploads PNG files successfully', async () => {
      // Create minimal PNG
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      const pngEnd = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82])
      const pngData = Buffer.concat([pngSignature, Buffer.alloc(100), pngEnd])

      const formData = new FormData()
      formData.append('file', new Blob([pngData], { type: 'image/png' }), 'test.png')

      const request = new Request('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })

      const response = await POST(request as any)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.type).toBe('image/png')
    })
  })

  describe('Error handling', () => {
    let authToken: string

    beforeEach(async () => {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: testUserEmail,
        password: testUserPassword
      })

      if (error || !data.session) {
        throw new Error(`Failed to sign in test user: ${error?.message}`)
      }

      authToken = data.session.access_token
    })

    it('handles invalid R2 credentials gracefully', async () => {
      // Temporarily break R2 credentials
      const originalKey = process.env.CLOUDFLARE_SECRET_ACCESS_KEY
      process.env.CLOUDFLARE_SECRET_ACCESS_KEY = 'invalid-key'

      const formData = new FormData()
      formData.append('file', new Blob(['test'], { type: 'image/jpeg' }), 'test.jpg')

      const request = new Request('http://localhost:5000/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })

      const response = await POST(request as any)
      const data = await response.json()

      // Restore credentials
      process.env.CLOUDFLARE_SECRET_ACCESS_KEY = originalKey

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to upload file')
    })
  })
})
