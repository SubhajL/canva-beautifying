import { S3Client } from "@aws-sdk/client-s3"

export const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || "beautifyai-storage"

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || "",
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