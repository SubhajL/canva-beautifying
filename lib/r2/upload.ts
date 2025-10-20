import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2Client, R2_BUCKET_NAME, getR2Key, R2_FOLDERS } from "./client"
import { getR2Config } from "./config"

interface UploadFileOptions {
  file: File | Buffer
  userId: string
  filename: string
  folder: keyof typeof R2_FOLDERS
  contentType?: string
  metadata?: Record<string, string>
}

export async function uploadFile({
  file,
  userId,
  filename,
  folder,
  contentType,
  metadata = {},
}: UploadFileOptions): Promise<{ key: string; url: string }> {
  const key = getR2Key(folder, userId, filename)
  const body = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType:
      contentType ||
      (file instanceof File ? file.type : "application/octet-stream"),
    Metadata: {
      userId,
      originalFilename: filename,
      uploadedAt: new Date().toISOString(),
      ...metadata,
    },
  })

  await r2Client.send(command)

  const { publicUrl } = getR2Config()
  const url = publicUrl ? `${publicUrl}/${key}` : await getSignedDownloadUrl(key)

  return { key, url }
}

export async function uploadBufferToKey({
  buffer,
  key,
  contentType,
  metadata = {},
}: {
  buffer: Buffer
  key: string
  contentType?: string
  metadata?: Record<string, string>
}): Promise<{ key: string; url: string }> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType || "application/octet-stream",
    Metadata: {
      uploadedAt: new Date().toISOString(),
      ...metadata,
    },
  })

  await r2Client.send(command)

  const { publicUrl } = getR2Config()
  const url = publicUrl ? `${publicUrl}/${key}` : await getSignedDownloadUrl(key)
  return { key, url }
}

async function getSignedDownloadUrl(key: string, expiresIn: number = 3600) {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
  return getSignedUrl(r2Client, command, { expiresIn })
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  await r2Client.send(command)
}

export async function deleteFiles(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => deleteFile(key)))
}
