import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { documentRoute } from '@/lib/api/openapi/decorators';
import { routeRegistry } from '@/lib/api/openapi/registry';
import { z } from 'zod';

// Response schemas
const betaMessageSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  type: z.string(),
  category: z.string().nullable(),
  priority: z.number(),
  action_url: z.string().nullable(),
  action_text: z.string().nullable(),
  metadata: z.any().nullable(),
  publish_at: z.string(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  is_read: z.boolean()
});

const messagesResponseSchema = z.object({
  messages: z.array(betaMessageSchema),
  unread_count: z.number(),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number()
  })
});

// GET /api/v1/beta/messages - Fetch beta messages for current user
const getMessagesHandler = async (request: NextRequest) => {
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

export const GET = documentRoute(
  getMessagesHandler,
  {
    method: 'GET',
    path: '/api/v1/beta/messages',
    operationId: 'getBetaMessages',
    summary: 'Get beta messages',
    description: 'Fetch beta messages for the current user with filtering and pagination',
    tags: ['Beta'],
    security: [{ bearer: [] }],
    parameters: [
      {
        name: 'category',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Filter messages by category'
      },
      {
        name: 'unread_only',
        in: 'query',
        required: false,
        schema: { type: 'boolean', default: false },
        description: 'Show only unread messages'
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        description: 'Number of messages to return'
      },
      {
        name: 'offset',
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 0, default: 0 },
        description: 'Number of messages to skip'
      }
    ]
  },
  undefined,
  {
    200: {
      description: 'Messages retrieved successfully',
      schema: messagesResponseSchema
    },
    401: {
      description: 'Unauthorized'
    },
    500: {
      description: 'Internal server error'
    }
  }
)

// Register routes
routeRegistry.registerRoute('/api/v1/beta/messages', 'GET')