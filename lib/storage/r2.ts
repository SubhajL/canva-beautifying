import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

/**
 * Custom error thrown when R2 storage is not properly configured
 */
export class R2NotConfiguredError extends Error {
  constructor() {
    super('R2 storage is not configured')
    this.name = 'R2NotConfiguredError'
  }
}

/**
 * Check if R2 storage is properly configured
 */
function isConfigured(): boolean {
  return !!(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET_NAME
  )
}

/**
 * Initialize R2 client
 */
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ACCOUNT_ID
    ? `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : undefined,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
})

/**
 * Response from getFileFromR2
 */
export interface R2FileResponse {
  Body: Buffer
  ContentType?: string
  ContentLength?: number
}

/**
 * Retrieve a file from R2 storage
 *
 * @param key - The S3 key/path of the file to retrieve
 * @returns File data with metadata, or null if file not found
 * @throws R2NotConfiguredError if R2 credentials are not configured
 * @throws Error for other storage errors
 */
export async function getFileFromR2(key: string): Promise<R2FileResponse | null> {
  // Check if R2 is configured
  if (!isConfigured()) {
    throw new R2NotConfiguredError()
  }

  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })

    const response = await r2Client.send(command)

    if (!response.Body) {
      return null
    }

    // Convert stream to buffer
    const byteArray = await response.Body.transformToByteArray()
    const buffer = Buffer.from(byteArray)

    return {
      Body: buffer,
      ContentType: response.ContentType,
      ContentLength: response.ContentLength,
    }
  } catch (error) {
    // Handle 404/NotFound errors
    if (error instanceof Error && (error.name === 'NoSuchKey' || error.name === 'NotFound')) {
      return null
    }

    // Re-throw other errors
    throw error
  }
}
