import { GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2/client'

type R2Object = {
  Body: Buffer
  ContentType?: string
  ContentLength?: number
}

function isConfigured() {
  return (
    !!process.env.CLOUDFLARE_ACCOUNT_ID &&
    !!process.env.CLOUDFLARE_ACCESS_KEY_ID &&
    !!process.env.CLOUDFLARE_SECRET_ACCESS_KEY &&
    !!R2_BUCKET_NAME
  )
}

export class R2NotConfiguredError extends Error {
  constructor() {
    super('R2_NOT_CONFIGURED')
    this.name = 'R2NotConfiguredError'
  }
}

export async function getFileFromR2(key: string): Promise<R2Object | null> {
  if (!isConfigured()) {
    throw new R2NotConfiguredError()
  }

  const cmd = new GetObjectCommand({ Bucket: R2_BUCKETNAME_SAFE(), Key: key })
  try {
    const res = await r2Client.send(cmd)
    if (!res.Body) return null
    const chunks: Uint8Array[] = []
    const stream = res.Body as AsyncIterable<Uint8Array>
    for await (const chunk of stream) chunks.push(chunk)
    return {
      Body: Buffer.concat(chunks),
      ContentType: res.ContentType,
      ContentLength: res.ContentLength,
    }
  } catch (err: any) {
    // NoSuchKey → treat as not found
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') {
      return null
    }
    throw err
  }
}

function R2_BUCKETNAME_SAFE() {
  return R2_BUCKET_NAME
}

