import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Admin check middleware (reuse from parent route)
async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  return user?.email && typeof user.email === 'string' ? adminEmails.includes(user.email) : false;
}

const updateMessageSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  category: z.enum(['announcement', 'feature_update', 'survey', 'maintenance', 'feedback_request', 'bug_fix', 'general']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  target_all_beta: z.boolean().optional(),
  target_user_ids: z.array(z.string().uuid()).optional().nullable(),
  target_tiers: z.array(z.enum(['free', 'basic', 'pro', 'premium'])).optional().nullable(),
  publish_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional().nullable(),
  send_email: z.boolean().optional(),
  email_subject: z.string().optional().nullable(),
  email_template: z.string().optional().nullable()
});

// GET /api/admin/beta/messages/[messageId] - Get message details with stats
export async function GET(
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

    // Get message with detailed stats
    const { data: message, error } = await supabase
      .from('beta_messages')
      .select(`
        *,
        created_by_user:users!beta_messages_created_by_fkey(email, name),
        beta_message_reads(user_id, read_at),
        beta_message_interactions(user_id, interaction_type, interaction_data, created_at),
        beta_email_log(user_id, email_status, email_sent_at, error_message)
      `)
      .eq('id', params.messageId)
      .single();

    if (error) {
      console.error('Error fetching message:', error);
      return NextResponse.json(
        { error: 'Failed to fetch message' },
        { status: 500 }
      );
    }

    // Calculate stats
    const stats = {
      total_reads: message.beta_message_reads?.length || 0,
      total_interactions: message.beta_message_interactions?.length || 0,
      email_stats: {
        sent: message.beta_email_log?.filter((e: { email_status: string }) => e.email_status === 'sent').length || 0,
        failed: message.beta_email_log?.filter((e: { email_status: string }) => e.email_status === 'failed').length || 0,
        pending: message.beta_email_log?.filter((e: { email_status: string }) => e.email_status === 'pending').length || 0
      },
      interaction_breakdown: message.beta_message_interactions?.reduce((acc: Record<string, number>, interaction: any) => {
        acc[interaction.interaction_type] = (acc[interaction.interaction_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return NextResponse.json({ 
      message: {
        ...message,
        stats
      }
    });

  } catch (error) {
    console.error('Admin message GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/beta/messages/[messageId] - Update message
export async function PATCH(
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

    // Parse and validate request body
    const body = await request.json();
    const validation = updateMessageSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Update message
    const { data: message, error } = await supabase
      .from('beta_messages')
      .update(validation.data)
      .eq('id', params.messageId)
      .select()
      .single();

    if (error) {
      console.error('Error updating message:', error);
      return NextResponse.json(
        { error: 'Failed to update message' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message });

  } catch (error) {
    console.error('Admin message update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/beta/messages/[messageId] - Delete message
export async function DELETE(
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

    // Delete message (cascades to related tables)
    const { error } = await supabase
      .from('beta_messages')
      .delete()
      .eq('id', params.messageId);

    if (error) {
      console.error('Error deleting message:', error);
      return NextResponse.json(
        { error: 'Failed to delete message' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Admin message delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}