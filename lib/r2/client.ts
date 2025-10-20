import { S3Client } from "@aws-sdk/client-s3"
import { getR2Config } from "./config"

const cfg = getR2Config()

export const R2_BUCKET_NAME = cfg.bucketName || ""

export const r2Client = new S3Client({
  region: "auto",
  endpoint: cfg.accountId ? `https://${cfg.accountId}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
  },
})

export function getR2Client() {
  return { client: r2Client, bucketName: R2_BUCKET_NAME }
}

export const R2_FOLDERS = {
  ORIGINAL: "original",
  ENHANCED: "enhanced",
  TEMP: "temp",
  ASSETS: "assets",
} as const

export function getR2Key(
  folder: keyof typeof R2_FOLDERS,
  userId: string,
  filename: string
): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_")
  return `${R2_FOLDERS[folder]}/${userId}/${timestamp}-${sanitizedFilename}`
}
