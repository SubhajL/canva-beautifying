import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { r2Client, R2_BUCKET_NAME } from "./client"
import { getR2Config } from "./config"

export async function downloadFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  const response = await r2Client.send(command)

  if (!response.Body) {
    throw new Error("File not found")
  }

  const chunks: Uint8Array[] = []
  const stream = response.Body as AsyncIterable<Uint8Array>

  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

export async function getDownloadUrl(
  key: string,
  expiresIn: number = 3600,
  filename?: string
): Promise<string> {
  const { publicUrl } = getR2Config()

  if (publicUrl) {
    return `${publicUrl}/${key}`
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: filename
      ? `attachment; filename="${filename}"`
      : undefined,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}

export async function getFileMetadata(key: string) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  const response = await r2Client.send(command)

  return {
    contentType: response.ContentType,
    contentLength: response.ContentLength,
    lastModified: response.LastModified,
    metadata: response.Metadata,
  }
}

export interface R2FileResponse {
  Body: Buffer
  ContentType?: string
  ContentLength?: number
}

export async function getFileFromR2(key: string): Promise<R2FileResponse | null> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
  try {
    const response = await r2Client.send(command)
    if (!response.Body) return null
    const byteArray = await (response.Body as any).transformToByteArray?.()
    const buffer = Buffer.from(byteArray)
    return {
      Body: buffer,
      ContentType: response.ContentType,
      ContentLength: response.ContentLength,
    }
  } catch (err: any) {
    // Treat 404 as not found
    const code = err?.$metadata?.httpStatusCode || err?.name
    if (code === 404 || code === 'NoSuchKey' || code === 'NotFound') return null
    throw err
  }
}
