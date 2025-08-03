import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Admin check middleware
async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  // You'll need to implement your admin check logic here
  // For now, we'll check if user has a specific role or is in an admin list
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();
  
  // Replace with your actual admin emails or role check
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  return adminEmails.includes(user?.email);
}

const createMessageSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(['announcement', 'feature_update', 'survey', 'maintenance', 'feedback_request', 'bug_fix', 'general']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  target_all_beta: z.boolean().default(true),
  target_user_ids: z.array(z.string().uuid()).optional().nullable(),
  target_tiers: z.array(z.enum(['free', 'basic', 'pro', 'premium'])).optional().nullable(),
  publish_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional().nullable(),
  send_email: z.boolean().default(false),
  email_subject: z.string().optional().nullable(),
  email_template: z.string().optional().nullable()
});

// GET /api/admin/beta/messages - List all beta messages (admin only)
export async function GET(_request: NextRequest) {
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

    // Get all messages with stats
    const { data: messages, error } = await supabase
      .from('beta_messages')
      .select(`
        *,
        created_by_user:users!beta_messages_created_by_fkey(email, name),
        read_count:beta_message_reads(count),
        interaction_count:beta_message_interactions(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages });

  } catch (error) {
    console.error('Admin messages GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/beta/messages - Create new beta message (admin only)
export async function POST(request: NextRequest) {
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
    const validation = createMessageSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const messageData = {
      ...validation.data,
      created_by: user.id
    };

    // Create message
    const { data: message, error } = await supabase
      .from('beta_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      console.error('Error creating message:', error);
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      );
    }

    // If email sending is enabled, queue email jobs
    if (message.send_email) {
      // This would integrate with your email queue system
      // For now, we'll just log it
      console.log('Email sending requested for message:', message.id);
    }

    return NextResponse.json({ message });

  } catch (error) {
    console.error('Admin message creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}