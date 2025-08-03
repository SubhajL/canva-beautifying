import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enhancementQueue } from '@/lib/queue/queues';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const batchEnhanceSchema = z.object({
  fileIds: z.array(z.string()).min(1).max(10),
  options: z.object({
    targetAudience: z.string().optional(),
    gradeLevel: z.string().optional(),
    style: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = batchEnhanceSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { fileIds, options = {} } = validationResult.data;

    // Check user's subscription and limits
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.subscription_tier || 'free';
    
    // Get batch limits based on tier
    const batchLimits: Record<string, number> = {
      free: 1,
      basic: 5,
      pro: 10,
      premium: 10,
    };

    const maxBatchSize = batchLimits[tier] || 1;
    
    if (fileIds.length > maxBatchSize) {
      return NextResponse.json(
        { 
          error: 'Batch size exceeded',
          message: `Your ${tier} plan allows up to ${maxBatchSize} files per batch`,
          maxBatchSize 
        },
        { status: 400 }
      );
    }

    // Check if user has enough credits
    const { count: usedEnhancements } = await supabase
      .from('enhancements')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(new Date().setDate(1)).toISOString());

    const monthlyLimits: Record<string, number> = {
      free: 10,
      basic: 100,
      pro: 500,
      premium: -1, // unlimited
    };

    const monthlyLimit = monthlyLimits[tier] || 10;
    const remainingCredits = monthlyLimit === -1 ? Infinity : monthlyLimit - (usedEnhancements || 0);

    if (remainingCredits < fileIds.length) {
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          message: `You need ${fileIds.length} credits but only have ${remainingCredits} remaining`,
          remainingCredits 
        },
        { status: 400 }
      );
    }

    // Verify all files exist and belong to user
    const { data: enhancements, error: fetchError } = await supabase
      .from('enhancements')
      .select('id, status, original_file_url')
      .in('id', fileIds)
      .eq('user_id', user.id);

    if (fetchError || !enhancements || enhancements.length !== fileIds.length) {
      return NextResponse.json(
        { error: 'Invalid file IDs' },
        { status: 400 }
      );
    }

    // Check if any files are already being processed
    const processingFiles = enhancements.filter(e => 
      e.status === 'processing' || e.status === 'queued'
    );

    if (processingFiles.length > 0) {
      return NextResponse.json(
        { 
          error: 'Files already processing',
          message: `${processingFiles.length} file(s) are already being processed`,
          processingIds: processingFiles.map(f => f.id)
        },
        { status: 400 }
      );
    }

    // Create batch ID
    const batchId = `batch_${nanoid()}`;

    // Update all enhancements with batch ID and status
    const { error: updateError } = await supabase
      .from('enhancements')
      .update({ 
        status: 'queued',
        batch_id: batchId,
        metadata: {
          ...options,
          batchSize: fileIds.length,
          batchPosition: 0, // Will be updated per file
        }
      })
      .in('id', fileIds);

    if (updateError) {
      console.error('Failed to update enhancements:', updateError);
      return NextResponse.json(
        { error: 'Failed to prepare batch' },
        { status: 500 }
      );
    }

    // Add jobs to queue with priority
    const jobs = await Promise.all(
      fileIds.map(async (fileId, index) => {
        // Update batch position
        await supabase
          .from('enhancements')
          .update({ 
            metadata: {
              ...options,
              batchSize: fileIds.length,
              batchPosition: index + 1,
            }
          })
          .eq('id', fileId);

        // Add to queue
        return enhancementQueue.add(
          'process-enhancement',
          {
            documentId: fileId,
            userId: user.id,
            analysisResults: {
              colors: {},
              typography: {},
              layout: {},
              content: {},
              quality: {}
            },
            enhancementSettings: {
              targetStyle: options && 'style' in options && typeof options.style === 'string' ? options.style : undefined,
              aiModel: 'auto'
            },
            subscriptionTier: tier,
          },
          {
            priority: (options && 'priority' in options && options.priority === 'high') ? 1 : 
                     (options && 'priority' in options && options.priority === 'low') ? 3 : 2,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          }
        );
      })
    );

    // Create batch tracking record
    const { error: batchError } = await supabase
      .from('batch_enhancements')
      .insert({
        id: batchId,
        user_id: user.id,
        file_count: fileIds.length,
        status: 'processing',
        enhancement_ids: fileIds,
        options,
      });

    if (batchError) {
      console.error('Failed to create batch record:', batchError);
      // Continue anyway, jobs are already queued
    }

    return NextResponse.json({
      success: true,
      batchId,
      fileCount: fileIds.length,
      jobs: jobs.map(job => ({
        id: job.id,
        fileId: job.data.documentId,
        status: 'queued',
      })),
      message: `Batch processing started for ${fileIds.length} files`,
    });

  } catch (error) {
    console.error('Batch enhancement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check batch status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json(
        { error: 'Batch ID required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get batch info
    const { data: batch, error: batchError } = await supabase
      .from('batch_enhancements')
      .select('*')
      .eq('id', batchId)
      .eq('user_id', user.id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Get enhancement statuses
    const { data: enhancements, error: enhancementsError } = await supabase
      .from('enhancements')
      .select('id, status, error_message, enhanced_file_url, created_at, updated_at')
      .in('id', batch.enhancement_ids)
      .order('created_at', { ascending: true });

    if (enhancementsError) {
      return NextResponse.json(
        { error: 'Failed to fetch enhancement statuses' },
        { status: 500 }
      );
    }

    // Calculate batch status
    const statuses = enhancements?.map(e => e.status) || [];
    const completedCount = statuses.filter(s => s === 'completed').length;
    const errorCount = statuses.filter(s => s === 'error').length;
    const processingCount = statuses.filter(s => s === 'processing' || s === 'queued').length;

    let batchStatus = batch.status;
    if (processingCount === 0) {
      if (errorCount === batch.file_count) {
        batchStatus = 'failed';
      } else if (completedCount === batch.file_count) {
        batchStatus = 'completed';
      } else {
        batchStatus = 'partial';
      }
    }

    // Update batch status if changed
    if (batchStatus !== batch.status) {
      await supabase
        .from('batch_enhancements')
        .update({ 
          status: batchStatus,
          completed_at: batchStatus !== 'processing' ? new Date().toISOString() : null,
        })
        .eq('id', batchId);
    }

    return NextResponse.json({
      batchId,
      status: batchStatus,
      fileCount: batch.file_count,
      completedCount,
      errorCount,
      processingCount,
      progress: Math.round((completedCount / batch.file_count) * 100),
      enhancements: enhancements?.map(e => ({
        id: e.id,
        status: e.status,
        error: e.error_message,
        enhancedUrl: e.enhanced_file_url,
      })),
      createdAt: batch.created_at,
      completedAt: batch.completed_at,
    });

  } catch (error) {
    console.error('Batch status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}