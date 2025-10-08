import { S3Client } from "@aws-sdk/client-s3"
import { NodeHttpHandler } from "@smithy/node-http-handler"
import https from "https"

// Environment configuration
export const R2_BUCKET_NAME =
  process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || "beautifyai-storage"

const DEFAULT_CLOUDFLARE_ENDPOINT = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
const R2_ENDPOINT = process.env.R2_ENDPOINT || DEFAULT_CLOUDFLARE_ENDPOINT
const R2_REGION = process.env.R2_REGION || "auto"
const FORCE_PATH_STYLE = process.env.R2_FORCE_PATH_STYLE === "true"

// Create R2 client with production-ready configuration
export const r2Client = new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  forcePathStyle: FORCE_PATH_STYLE,
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      // Keep alive for connection reuse
      keepAlive: true,
      keepAliveMsecs: 1000,
      // Timeout settings
      timeout: 30000,
      // TLS settings - let Node.js negotiate the best version
      // Remove forced TLS 1.2 unless absolutely required
      minVersion: 'TLSv1.2',
      // Allow the system to negotiate ciphers
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    })
  }),
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "",
  },
  maxAttempts: 3,
  retryMode: 'adaptive'
})

// Helper functions remain the same
export const R2_FOLDERS = {
  ORIGINAL: "original",
  ENHANCED: "enhanced",
  TEMP: "temp",
  ASSETS: "assets",
} as const

export function getR2Key(folder: keyof typeof R2_FOLDERS, userId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_")
  return `${R2_FOLDERS[folder]}/${userId}/${timestamp}-${sanitizedFilename}`
}