import { S3Client } from "@aws-sdk/client-s3"
import { NodeHttpHandler } from "@smithy/node-http-handler"
import https from "https"
import crypto from "crypto"

// Allow both new and legacy bucket envs
export const R2_BUCKET_NAME =
  process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || "beautifyai-storage"

const DEFAULT_CLOUDFLARE_ENDPOINT = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
const R2_ENDPOINT = process.env.R2_ENDPOINT || DEFAULT_CLOUDFLARE_ENDPOINT
const R2_REGION = process.env.R2_REGION || "auto"
const FORCE_PATH_STYLE = process.env.R2_FORCE_PATH_STYLE === "true"

// Create HTTPS agent with proper TLS configuration
function createHttpsAgent(): https.Agent {
  const useTls12 = process.env.R2_TLS12 === 'true'
  const noTls13 = process.env.R2_TLS_NO_TLS13 === 'true'
  const ciphers = process.env.R2_TLS_CIPHERS

  const options: https.AgentOptions = {}

  // TLS version configuration
  if (useTls12) {
    options.minVersion = 'TLSv1.2'
    options.maxVersion = 'TLSv1.2'
  }

  // Disable TLS 1.3 if requested
  if (noTls13 && !useTls12) {
    options.maxVersion = 'TLSv1.2'
  }

  // Custom ciphers
  if (ciphers) {
    options.ciphers = ciphers
  }

  // Add legacy server connect option for compatibility
  if (useTls12 || noTls13) {
    options.secureOptions = crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
  }

  return new https.Agent(options)
}

export const r2Client = new S3Client({
  region: R2_REGION,
  endpoint: R2_ENDPOINT,
  forcePathStyle: FORCE_PATH_STYLE,
  requestHandler: new NodeHttpHandler({
    httpsAgent: createHttpsAgent()
  }),
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || "",
  },
})

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