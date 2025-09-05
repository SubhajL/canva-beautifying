import { NextRequest, NextResponse } from 'next/server';
import { verifyTemporaryAccessToken, downloadSecureFile } from '@/lib/r2/secure-storage';
import { AuthenticationError, NotFoundError } from '@/lib/utils/api-error-handler';
import { withErrorHandling } from '@/lib/middleware/error-middleware';
import { documentRoute } from '@/lib/api/openapi/decorators';
import { routeRegistry } from '@/lib/api/openapi/registry';

const getSecureFileHandler = async (
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) => {
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
}

export const GET = withErrorHandling(
  documentRoute(
    getSecureFileHandler,
    {
      method: 'GET',
      path: '/api/v1/secure-files/{key}',
      operationId: 'getSecureFile',
      summary: 'Access secure file',
      description: 'Downloads a secure file with temporary token-based authentication',
      tags: ['Downloads'],
      parameters: [
        {
          name: 'key',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'File key (path)'
        },
        {
          name: 'token',
          in: 'query',
          required: true,
          schema: { type: 'string' },
          description: 'Temporary access token'
        }
      ]
    },
    undefined,
    {
      200: {
        description: 'File download',
        content: {
          'application/pdf': {
            schema: {
              type: 'string',
              format: 'binary'
            }
          },
          'image/png': {
            schema: {
              type: 'string',
              format: 'binary'
            }
          },
          'image/jpeg': {
            schema: {
              type: 'string',
              format: 'binary'
            }
          },
          'application/octet-stream': {
            schema: {
              type: 'string',
              format: 'binary'
            }
          }
        }
      },
      401: {
        description: 'Unauthorized - Access token required or invalid'
      },
      404: {
        description: 'File not found'
      },
      500: {
        description: 'Internal server error'
      }
    }
  )
)

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

// Register routes
routeRegistry.registerRoute('/api/v1/secure-files/{key}', 'GET')