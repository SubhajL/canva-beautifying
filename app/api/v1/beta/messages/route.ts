import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/v1/beta/messages - Fetch beta messages for current user
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('beta_messages')
      .select(`
        *,
        beta_message_reads!left(read_at)
      `)
      .eq('beta_message_reads.user_id', user.id)
      .lte('publish_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('publish_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    // Add expiry filter
    query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching beta messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Process messages to include read status
    const processedMessages = messages?.map(msg => {
      const { beta_message_reads, ...message } = msg;
      return {
        ...message,
        is_read: beta_message_reads && beta_message_reads.length > 0
      };
    }) || [];

    // Filter unread if requested
    const finalMessages = unreadOnly 
      ? processedMessages.filter(msg => !msg.is_read)
      : processedMessages;

    // Get total unread count
    const { data: unreadCount } = await supabase
      .rpc('get_unread_beta_message_count', { p_user_id: user.id });

    return NextResponse.json({
      messages: finalMessages,
      unread_count: unreadCount || 0,
      pagination: {
        limit,
        offset,
        total: finalMessages.length
      }
    });

  } catch (error) {
    console.error('Beta messages GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}