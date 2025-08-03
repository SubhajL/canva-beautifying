import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Queue } from 'bullmq';
import { redis } from '@/lib/queue/redis';
import { z } from 'zod';

// Admin check middleware
async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  return user?.email && typeof user.email === 'string' ? adminEmails.includes(user.email) : false;
}

const betaEmailQueue = new Queue('beta-emails', {
  connection: redis
});

const sendEmailsSchema = z.object({
  test: z.boolean().optional(),
  testEmail: z.string().email().optional()
});

// POST /api/admin/beta/messages/[messageId]/send-emails - Queue email sending
export async function POST(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication and admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !(await isAdmin(supabase, user.id))) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const validation = sendEmailsSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { test = false, testEmail } = validation.data;
    const messageId = params.messageId;

    // Verify message exists and has email enabled
    const { data: message, error: messageError } = await supabase
      .from('beta_messages')
      .select('id, send_email, email_subject')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (!test && !message.send_email) {
      return NextResponse.json(
        { error: 'Email sending is not enabled for this message' },
        { status: 400 }
      );
    }

    // Queue the email job
    const job = await betaEmailQueue.add(
      test ? 'test-email' : 'send-emails',
      {
        messageId,
        action: test ? 'test' : 'send',
        testEmail: test ? testEmail : undefined
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: test 
        ? `Test email queued for ${testEmail}` 
        : 'Email sending queued for all recipients'
    });

  } catch (error) {
    console.error('Email queue error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}