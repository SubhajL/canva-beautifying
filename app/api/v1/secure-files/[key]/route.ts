import { NextRequest, NextResponse } from 'next/server';
import { verifyTemporaryAccessToken, downloadSecureFile } from '@/lib/r2/secure-storage';
import { AuthenticationError, NotFoundError } from '@/lib/utils/api-error-handler';
import { withErrorHandling } from '@/lib/middleware/error-middleware';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  return withErrorHandling(request, async (req) => {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const { key: rawKey } = await context.params;
  const key = decodeURIComponent(rawKey);

  // Verify token
  if (!token) {
    throw AuthenticationError.create('Access token required');
  }

  const tokenData = verifyTemporaryAccessToken(token);
  if (!tokenData.valid || tokenData.key !== key) {
    throw AuthenticationError.create('Invalid or expired access token');
  }

  try {
    // Download and decrypt file
    const fileBuffer = await downloadSecureFile(key, tokenData.userId!);
    
    // Determine content type from key
    const extension = key.split('.').pop()?.toLowerCase();
    const contentType = getContentType(extension);

    // Return decrypted file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${key.split('/').pop()}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Secure file access error:', error);
    throw NotFoundError.create('File');
  }
  });
}

function getContentType(extension?: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };

  return mimeTypes[extension || ''] || 'application/octet-stream';
}