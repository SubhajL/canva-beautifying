import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CacheInvalidator } from '../../../../lib/cache/cache-invalidator'
import { redis } from '../../../../lib/queue/redis'
import { logger } from '../../../../lib/observability'

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
    const { type, targetId, options } = body

    // Validate request
    if (!type || !targetId) {
      return NextResponse.json(
        { error: 'Missing required fields: type and targetId' },
        { status: 400 }
      )
    }

    // Check user permissions (admin only for now)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Create cache invalidator instance
    const invalidator = new CacheInvalidator(redis)
    let result

    // Perform invalidation based on type
    switch (type) {
      case 'document':
        result = await invalidator.invalidateDocument(targetId, options?.cascade ?? true)
        break
      
      case 'user':
        result = await invalidator.invalidateUserCache(targetId, {
          preservePreferences: options?.preservePreferences,
          preserveHistory: options?.preserveHistory
        })
        break
      
      case 'model':
        result = await invalidator.invalidateModelCache(targetId, {
          preserveHighQuality: options?.preserveHighQuality,
          afterDate: options?.afterDate ? new Date(options.afterDate) : undefined
        })
        break
      
      case 'pattern':
        // Extra validation for pattern invalidation
        if (!invalidator.validatePattern(targetId)) {
          return NextResponse.json(
            { error: 'Invalid or dangerous pattern' },
            { status: 400 }
          )
        }
        result = await invalidator.invalidateByPattern(targetId, {
          dryRun: options?.dryRun,
          limit: options?.limit
        })
        break
      
      case 'expired':
        result = await invalidator.invalidateExpired()
        break
      
      default:
        return NextResponse.json(
          { error: `Invalid invalidation type: ${type}` },
          { status: 400 }
        )
    }

    // Log the invalidation
    logger.info('Cache invalidation performed', {
      userId: user.id,
      type,
      targetId,
      result
    })

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    logger.error('Cache invalidation failed', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check invalidation capabilities
export async function GET(request: NextRequest) {
  // Return available invalidation types and options
  return NextResponse.json({
    availableTypes: [
      {
        type: 'document',
        description: 'Invalidate all cache entries for a specific document',
        options: {
          cascade: 'boolean - Whether to cascade invalidation to related entries (default: true)'
        }
      },
      {
        type: 'user',
        description: 'Invalidate all cache entries for a specific user',
        options: {
          preservePreferences: 'boolean - Keep user preferences cached',
          preserveHistory: 'boolean - Keep user history cached'
        }
      },
      {
        type: 'model',
        description: 'Invalidate all cache entries for a specific AI model',
        options: {
          preserveHighQuality: 'boolean - Keep high quality results',
          afterDate: 'string - Only invalidate entries created after this date (ISO format)'
        }
      },
      {
        type: 'pattern',
        description: 'Invalidate cache entries matching a pattern',
        options: {
          dryRun: 'boolean - Simulate invalidation without deleting',
          limit: 'number - Maximum number of keys to invalidate'
        }
      },
      {
        type: 'expired',
        description: 'Clean up expired cache entries',
        options: {}
      }
    ]
  })
}