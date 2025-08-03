import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// POST /api/v1/beta/messages/[messageId]/read - Mark message as read
export async function POST(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
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

    const messageId = params.messageId;

    // Mark message as read
    const { error } = await supabase
      .rpc('mark_beta_message_read', {
        p_message_id: messageId,
        p_user_id: user.id
      });

    if (error) {
      console.error('Error marking message as read:', error);
      return NextResponse.json(
        { error: 'Failed to mark message as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}