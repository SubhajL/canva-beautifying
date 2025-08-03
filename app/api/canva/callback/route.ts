import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CanvaOAuth } from '@/lib/canva/oauth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Unknown error';
    console.error('Canva OAuth error:', error, errorDescription);
    
    return NextResponse.redirect(
      new URL(`/upload?canva_error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/upload?canva_error=Missing+authorization+code', request.url)
    );
  }

  try {
    // Verify state parameter (you should store and validate this)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL('/login?redirect=/upload', request.url)
      );
    }

    // Exchange code for token
    const token = await CanvaOAuth.exchangeCodeForToken(code);

    // Store token in database
    await CanvaOAuth.storeToken(user.id, token);

    // Redirect back to upload page with success
    return NextResponse.redirect(
      new URL('/upload?canva_connected=true', request.url)
    );
  } catch (error) {
    console.error('Failed to complete Canva OAuth:', error);
    
    return NextResponse.redirect(
      new URL(`/upload?canva_error=${encodeURIComponent('Failed to connect Canva account')}`, request.url)
    );
  }
}