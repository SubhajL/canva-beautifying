import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CanvaOAuth } from '@/lib/canva/oauth';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Remove stored token
    await CanvaOAuth.removeToken(user.id);
    
    return NextResponse.json({
      success: true,
      message: 'Canva account disconnected successfully',
    });
  } catch (error) {
    console.error('Failed to disconnect Canva account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}