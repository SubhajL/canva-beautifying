import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
// Get CSRF secret from environment with proper validation
const getCSRFSecret = (): string => {
  const secret = process.env.CSRF_SECRET;
  
  if (!secret) {
    throw new Error(
      'CSRF_SECRET environment variable is required. ' +
      'Please set it to a secure random string of at least 32 characters.'
    );
  }
  
  if (secret.length < 32) {
    throw new Error(
      'CSRF_SECRET must be at least 32 characters long for security. ' +
      `Current length: ${secret.length}`
    );
  }
  
  if (process.env.NODE_ENV === 'production' && secret.startsWith('default-csrf-secret')) {
    throw new Error(
      'Default CSRF_SECRET detected in production. ' +
      'Please generate a secure random secret.'
    );
  }
  
  return secret;
};

const CSRF_SECRET_KEY = getCSRFSecret();

// Generate a new CSRF token
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

// Create a signed CSRF token
export function signCSRFToken(token: string): string {
  const hmac = crypto.createHmac('sha256', CSRF_SECRET_KEY);
  hmac.update(token);
  const signature = hmac.digest('hex');
  return `${token}.${signature}`;
}

// Verify a signed CSRF token
export function verifyCSRFToken(signedToken: string): boolean {
  const parts = signedToken.split('.');
  if (parts.length !== 2) return false;

  const [token, signature] = parts;
  const hmac = crypto.createHmac('sha256', CSRF_SECRET_KEY);
  hmac.update(token);
  const expectedSignature = hmac.digest('hex');

  // Use timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Get CSRF token from request
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  // Check header first (for AJAX requests)
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) return headerToken;

  // Check form data (for form submissions)
  const contentType = request.headers.get('content-type');
  if (contentType?.includes('application/x-www-form-urlencoded')) {
    // This would need to be parsed from the request body
    // For now, we'll rely on header-based CSRF
  }

  return null;
}

// Set CSRF token cookie
export async function setCSRFCookie(token: string) {
  const cookieStore = await cookies();
  const signedToken = signCSRFToken(token);
  
  cookieStore.set(CSRF_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

// Get CSRF token from cookie
export async function getCSRFCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const signedToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  
  if (!signedToken) return null;
  
  // Verify the token is valid
  if (!verifyCSRFToken(signedToken)) return null;
  
  // Extract the token part
  return signedToken.split('.')[0];
}

// Validate CSRF token
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }

  // Get token from cookie
  const cookieToken = await getCSRFCookie();
  if (!cookieToken) return false;

  // Get token from request
  const requestToken = getCSRFTokenFromRequest(request);
  if (!requestToken) return false;

  // Compare tokens
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(requestToken)
  );
}

// CSRF middleware for API routes
export async function csrfProtection(request: NextRequest): Promise<Response | null> {
  // Skip CSRF for public API endpoints
  const publicEndpoints = [
    '/api/auth',
    '/api/webhook',
    '/api/health',
  ];
  
  const pathname = new URL(request.url).pathname;
  if (publicEndpoints.some(endpoint => pathname.startsWith(endpoint))) {
    return null;
  }

  // Validate CSRF token
  const isValid = await validateCSRFToken(request);
  if (!isValid) {
    return new Response(
      JSON.stringify({
        error: 'CSRF token validation failed',
        code: 'CSRF_VALIDATION_FAILED',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return null;
}

// React hook for CSRF protection (client-side)
export function useCSRFToken() {
  if (typeof window === 'undefined') return null;

  // Get CSRF token from meta tag
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag?.getAttribute('content') || null;
}

// Helper to add CSRF token to fetch requests
export function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  
  if (csrfToken) {
    options.headers = {
      ...options.headers,
      [CSRF_HEADER_NAME]: csrfToken,
    };
  }

  return fetch(url, options);
}

// Double Submit Cookie Pattern implementation
export class DoubleSubmitCSRF {
  private tokenStore = new Map<string, { token: string; expires: number }>();

  generateToken(sessionId: string): string {
    const token = generateCSRFToken();
    const expires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    this.tokenStore.set(sessionId, { token, expires });
    this.cleanup();
    
    return token;
  }

  validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokenStore.get(sessionId);
    if (!stored) return false;
    
    if (stored.expires < Date.now()) {
      this.tokenStore.delete(sessionId);
      return false;
    }
    
    // Check length first to avoid timing safe equal errors
    if (stored.token.length !== token.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(stored.token),
      Buffer.from(token)
    );
  }

  private cleanup() {
    const now = Date.now();
    for (const [sessionId, data] of this.tokenStore.entries()) {
      if (data.expires < now) {
        this.tokenStore.delete(sessionId);
      }
    }
  }
}

// Helper to generate a secure CSRF secret
export function generateSecureCSRFSecret(): string {
  return crypto.randomBytes(32).toString('base64');
}

// Helper to validate CSRF secret configuration
export function validateCSRFSecret(secret: string): { valid: boolean; error?: string } {
  if (!secret) {
    return { valid: false, error: 'CSRF secret is required' };
  }
  
  if (secret.length < 32) {
    return { valid: false, error: 'CSRF secret must be at least 32 characters' };
  }
  
  if (secret.startsWith('default-csrf-secret')) {
    return { valid: false, error: 'Default CSRF secret detected - please change it' };
  }
  
  return { valid: true };
}