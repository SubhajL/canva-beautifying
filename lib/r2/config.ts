export type R2Config = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicUrl?: string
}

export function getR2Config(): R2Config {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL

  const missing: string[] = []
  if (!accountId) missing.push('CLOUDFLARE_R2_ACCOUNT_ID')
  if (!accessKeyId) missing.push('CLOUDFLARE_R2_ACCESS_KEY_ID')
  if (!secretAccessKey) missing.push('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
  if (!bucketName) missing.push('CLOUDFLARE_R2_BUCKET_NAME')

  // In production, fail fast when variables are missing
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`CLOUDFLARE_R2_ variables missing: ${missing.join(', ')}`)
  }

  return {
    accountId: accountId || '',
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
    bucketName: bucketName || '',
    publicUrl: publicUrl || undefined,
  }
}