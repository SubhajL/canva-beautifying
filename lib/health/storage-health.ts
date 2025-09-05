import { getR2Client } from '@/lib/r2/client'
import { HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import type { HealthCheckResult } from './types'

export async function checkStorageHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  const testKey = `health-check/test-${Date.now()}`
  
  try {
    const { client, bucketName } = getR2Client()
    
    // Test write operation
    const writeStart = Date.now()
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: 'health-check',
      ContentType: 'text/plain'
    }))
    const writeLatency = Date.now() - writeStart
    
    // Test read operation
    const readStart = Date.now()
    await client.send(new HeadObjectCommand({
      Bucket: bucketName,
      Key: testKey
    }))
    const readLatency = Date.now() - readStart
    
    // Cleanup test object
    await client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey
    }))
    
    // Determine health status
    const totalLatency = writeLatency + readLatency
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let message = 'Storage is operational'
    
    if (totalLatency > 500) {
      status = 'degraded'
      message = `Storage latency is high: ${totalLatency}ms`
    }
    
    if (totalLatency > 2000) {
      status = 'unhealthy'
      message = `Storage latency is critical: ${totalLatency}ms`
    }
    
    return {
      service: 'storage',
      status,
      responseTime: Date.now() - startTime,
      details: {
        writeLatency,
        readLatency,
        totalLatency,
        connected: true,
        message
      }
    }
  } catch (error) {
    // Try to clean up even on error
    try {
      const { client, bucketName } = getR2Client()
      await client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: testKey
      }))
    } catch {
      // Ignore cleanup errors
    }
    
    return {
      service: 'storage',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Storage connection failed',
      details: {
        connected: false
      }
    }
  }
}