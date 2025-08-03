import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CanvaOAuth } from '@/lib/canva/oauth';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has a valid Canva token
    const token = await CanvaOAuth.getStoredToken(user.id);
    
    return NextResponse.json({
      connected: !!token,
      hasValidToken: !!token,
    });
  } catch (error) {
    console.error('Failed to check Canva auth status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}