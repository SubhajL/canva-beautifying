import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const interactionSchema = z.object({
  interaction_type: z.string(),
  interaction_data: z.record(z.any()).optional()
});

// POST /api/v1/beta/messages/[messageId]/interact - Track message interaction
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

    // Parse request body
    const body = await request.json();
    const validation = interactionSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { interaction_type, interaction_data = {} } = validation.data;
    const messageId = params.messageId;

    // Record interaction
    const { data, error } = await supabase
      .from('beta_message_interactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        interaction_type,
        interaction_data
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording interaction:', error);
      return NextResponse.json(
        { error: 'Failed to record interaction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      interaction: data 
    });

  } catch (error) {
    console.error('Interaction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}