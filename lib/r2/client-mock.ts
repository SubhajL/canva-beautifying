/**
 * Mock R2 client for testing outside of Next.js context
 */

export async function uploadToR2(buffer: Buffer, key: string): Promise<string> {
  // For testing, just return a mock URL
  console.log(`[Mock] Would upload ${buffer.length} bytes to R2 with key: ${key}`)
  return `https://r2.example.com/${key}`
}

export async function getR2Url(key: string): Promise<string> {
  return `https://r2.example.com/${key}`
}

export async function deleteFromR2(key: string): Promise<void> {
  console.log(`[Mock] Would delete from R2: ${key}`)
}