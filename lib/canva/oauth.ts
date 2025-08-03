import { CANVA_API_CONFIG, CanvaAuthToken } from './api-config';
import { createClient } from '@/lib/supabase/server';

export class CanvaOAuth {
  // Generate OAuth authorization URL
  static getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: CANVA_API_CONFIG.oauth.clientId,
      redirect_uri: CANVA_API_CONFIG.oauth.redirectUri,
      response_type: 'code',
      scope: CANVA_API_CONFIG.oauth.scopes.join(' '),
      state,
    });

    return `${CANVA_API_CONFIG.oauth.authorizationUrl}?${params}`;
  }

  // Exchange authorization code for access token
  static async exchangeCodeForToken(code: string): Promise<CanvaAuthToken> {
    const response = await fetch(CANVA_API_CONFIG.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CANVA_API_CONFIG.oauth.clientId,
        client_secret: CANVA_API_CONFIG.oauth.clientSecret,
        redirect_uri: CANVA_API_CONFIG.oauth.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error_description || 'Failed to exchange code for token');
    }

    const data = await response.json();
    
    return {
      ...data,
      created_at: Date.now(),
    };
  }

  // Refresh access token
  static async refreshToken(refreshToken: string): Promise<CanvaAuthToken> {
    const response = await fetch(CANVA_API_CONFIG.oauth.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CANVA_API_CONFIG.oauth.clientId,
        client_secret: CANVA_API_CONFIG.oauth.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error_description || 'Failed to refresh token');
    }

    const data = await response.json();
    
    return {
      ...data,
      created_at: Date.now(),
    };
  }

  // Store token in database
  static async storeToken(userId: string, token: CanvaAuthToken) {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('canva_tokens')
      .upsert({
        user_id: userId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(token.created_at + token.expires_in * 1000).toISOString(),
        scope: token.scope,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to store token: ${error.message}`);
    }
  }

  // Retrieve token from database
  static async getStoredToken(userId: string): Promise<CanvaAuthToken | null> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('canva_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if token is expired
    const expiresAt = new Date(data.expires_at).getTime();
    const now = Date.now();

    if (now >= expiresAt && data.refresh_token) {
      // Try to refresh the token
      try {
        const newToken = await this.refreshToken(data.refresh_token);
        await this.storeToken(userId, newToken);
        return newToken;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return null;
      }
    }

    return {
      access_token: data.access_token,
      token_type: 'Bearer',
      expires_in: Math.floor((expiresAt - now) / 1000),
      refresh_token: data.refresh_token,
      scope: data.scope,
      created_at: new Date(data.updated_at).getTime(),
    };
  }

  // Remove stored token
  static async removeToken(userId: string) {
    const supabase = await createClient();
    
    await supabase
      .from('canva_tokens')
      .delete()
      .eq('user_id', userId);
  }
}