import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CanvaOAuth } from '@/lib/canva/oauth';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { state } = await request.json();
    
    // Generate OAuth URL
    const authUrl = CanvaOAuth.getAuthorizationUrl(state || user.id);
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Failed to generate Canva auth URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}