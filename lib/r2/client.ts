import { S3Client } from "@aws-sdk/client-s3"
import { NodeHttpHandler } from "@smithy/node-http-handler"
import * as https from "https"

// Configuration constants
const R2_BUCKET_NAME =
  process.env.CLOUDFLARE_R2_BUCKET_NAME ||
  process.env.R2_BUCKET_NAME ||
  "beautifyai-storage"

const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`

const R2_REGION = process.env.R2_REGION || "auto"
const FORCE_PATH_STYLE = process.env.R2_FORCE_PATH_STYLE === "true"

// Create a simple, production-ready HTTPS agent
const httpsAgent = new https.Agent({
  // Connection pooling for performance
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,

  // Timeouts to prevent hanging
  timeout: 30000,

  // Security: require TLS 1.2 minimum
  minVersion: 'TLSv1.2',

  // Let Node.js negotiate the best cipher suite
  // No forced ciphers or TLS restrictions
})

// Initialize S3 client with clean configuration
const r2Client = new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  forcePathStyle: FORCE_PATH_STYLE,

  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "",
  },

  requestHandler: new NodeHttpHandler({
    httpsAgent,
    connectionTimeout: 30000,
    socketTimeout: 30000,
  }),

  // Retry configuration for resilience
  maxAttempts: 3,
  retryMode: 'adaptive',
})

// Folder structure constants
const R2_FOLDERS = {
  ORIGINAL: "original",
  ENHANCED: "enhanced",
  TEMP: "temp",
  ASSETS: "assets",
} as const

// Utility function to generate consistent R2 keys
function getR2Key(
  folder: keyof typeof R2_FOLDERS,
  userId: string,
  filename: string
): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_")
  return `${R2_FOLDERS[folder]}/${userId}/${timestamp}-${sanitizedFilename}`
}

// Exports
export { r2Client, R2_BUCKET_NAME, R2_FOLDERS, getR2Key }