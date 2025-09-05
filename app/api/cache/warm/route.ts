import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CacheWarmer } from '../../../../lib/cache/cache-warmer'
import { documentCache, enhancementCache, aiResponseCache } from '../../../../lib/cache/init'
import { AIService } from '../../../../lib/ai/ai-service'
import { logger } from '../../../../lib/observability'

// Type for warming job
type WarmingJob = {
  startTime: Date
  type: string
  status: 'running' | 'completed' | 'failed'
  progress?: number
  error?: string
}

// Keep track of warming jobs to prevent duplicates
const activeWarmingJobs = new Map<string, WarmingJob>()

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const supabase = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { type, options } = body

    // Validate request
    if (!type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      )
    }

    // Check if a warming job is already running
    const jobKey = `${type}-${JSON.stringify(options || {})}`
    const existingJob = activeWarmingJobs.get(jobKey)
    
    if (existingJob && existingJob.status === 'running') {
      const runningTime = Date.now() - existingJob.startTime.getTime()
      if (runningTime < 5 * 60 * 1000) { // 5 minutes timeout
        return NextResponse.json({
          status: 'already_running',
          job: {
            type: existingJob.type,
            startTime: existingJob.startTime,
            runningTime,
            progress: existingJob.progress
          }
        })
      }
    }

    // Create warming job
    const job: WarmingJob = {
      startTime: new Date(),
      type,
      status: 'running',
      progress: 0
    }
    activeWarmingJobs.set(jobKey, job)

    // Create cache warmer instance
    const aiService = new AIService()
    const warmer = new CacheWarmer(
      documentCache,
      enhancementCache,
      aiService
    )

    // Start warming in background
    const warmingPromise = (async () => {
      try {
        let result
        
        switch (type) {
          case 'popular':
            const limit = options?.limit || 50
            result = await warmer.warmPopularDocuments(limit)
            break
          
          case 'user':
            if (!options?.userId) {
              throw new Error('userId required for user warming')
            }
            const userLimit = options?.limit || 10
            result = await warmer.preloadUserHistory(options.userId, userLimit)
            break
          
          case 'pattern':
            if (!options?.pattern) {
              throw new Error('pattern required for pattern warming')
            }
            result = await warmer.warmByPattern(options.pattern)
            break
          
          case 'scheduled':
            // This would typically be called by a cron job
            // For API, we'll do a one-time popular documents warm
            result = await warmer.warmPopularDocuments(25)
            break
          
          default:
            throw new Error(`Invalid warming type: ${type}`)
        }

        job.status = 'completed'
        job.progress = 100
        
        logger.info('Cache warming completed', {
          userId: user.id,
          type,
          options,
          result
        })
        
        return result
        
      } catch (error) {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : 'Unknown error'
        
        logger.error('Cache warming failed', {
          userId: user.id,
          type,
          options,
          error
        })
        
        throw error
      } finally {
        // Clean up job after 1 hour
        setTimeout(() => {
          activeWarmingJobs.delete(jobKey)
        }, 60 * 60 * 1000)
      }
    })()

    // Don't wait for warming to complete - return immediately
    // Client can poll the status endpoint
    return NextResponse.json({
      success: true,
      jobId: jobKey,
      message: 'Cache warming started',
      type,
      options
    })

  } catch (error) {
    logger.error('Cache warming request failed', { error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check warming status
export async function GET(request: NextRequest) {
  try {
    // Get job ID from query params
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (jobId) {
      // Return specific job status
      const job = activeWarmingJobs.get(jobId)
      
      if (!job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        jobId,
        type: job.type,
        status: job.status,
        startTime: job.startTime,
        runningTime: Date.now() - job.startTime.getTime(),
        progress: job.progress,
        error: job.error
      })
    }

    // Return all active jobs and available warming types
    const activeJobs = Array.from(activeWarmingJobs.entries()).map(([id, job]) => ({
      id,
      type: job.type,
      status: job.status,
      startTime: job.startTime,
      runningTime: Date.now() - job.startTime.getTime(),
      progress: job.progress
    }))

    return NextResponse.json({
      activeJobs,
      availableTypes: [
        {
          type: 'popular',
          description: 'Warm cache with popular documents',
          options: {
            limit: 'number - Maximum number of documents to warm (default: 50)'
          }
        },
        {
          type: 'user',
          description: 'Preload user\'s recent documents',
          options: {
            userId: 'string - User ID (required)',
            limit: 'number - Maximum number of documents (default: 10)'
          }
        },
        {
          type: 'pattern',
          description: 'Warm cache for documents matching a pattern',
          options: {
            pattern: 'string - Pattern to match (required)'
          }
        },
        {
          type: 'scheduled',
          description: 'Run scheduled warming (usually called by cron)',
          options: {}
        }
      ]
    })

  } catch (error) {
    logger.error('Failed to get warming status', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}