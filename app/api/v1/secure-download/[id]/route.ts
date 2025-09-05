import { NextRequest, NextResponse } from 'next/server'
import { validateDownloadToken, logDownloadAccess } from '@/lib/api/download/token-validator'
import { errorResponse, apiErrors } from '@/lib/api/response'
import { getFileFromR2 } from '@/lib/storage/r2'
import { documentRoute } from '@/lib/api/openapi/decorators'
import { routeRegistry } from '@/lib/api/openapi/registry'

const getSecureDownloadHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const documentId = params.id
    
    // Validate download token
    const permission = await validateDownloadToken(request, documentId)
    
    if (!permission.canDownload) {
      await logDownloadAccess(documentId, permission.userId, false, {
        reason: permission.reason
      })
      
      throw new Error(permission.reason || 'Download not permitted')
    }
    
    // Log successful access
    await logDownloadAccess(documentId, permission.userId, true)
    
    // Fetch file from storage
    const fileData = await getFileFromR2(`enhanced/${permission.userId}/${documentId}`)
    
    if (!fileData) {
      throw apiErrors.NOT_FOUND
    }
    
    // Return file with appropriate headers
    return new NextResponse(fileData.Body, {
      headers: {
        'Content-Type': fileData.ContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${documentId}.pdf"`,
        'Content-Length': fileData.ContentLength?.toString() || '0',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    })
  } catch (error) {
    console.error('Secure download error:', error)
    
    if (error instanceof Error && error.message === 'Download not permitted') {
      return errorResponse(apiErrors.FORBIDDEN)
    }
    
    return errorResponse(error as Error)
  }
}

export const GET = documentRoute(
  getSecureDownloadHandler,
  {
    method: 'GET',
    path: '/api/v1/secure-download/{id}',
    operationId: 'secureDownloadFile',
    summary: 'Download enhanced document',
    description: 'Downloads an enhanced document with token-based authentication and access logging',
    tags: ['Downloads'],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Document ID'
      },
      {
        name: 'token',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Download token (can also be provided in Authorization header)'
      }
    ],
    security: [
      { bearer: [] },
      { downloadToken: [] }
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
        'application/octet-stream': {
          schema: {
            type: 'string',
            format: 'binary'
          }
        }
      }
    },
    401: {
      description: 'Unauthorized - Invalid or missing token'
    },
    403: {
      description: 'Forbidden - Download not permitted'
    },
    404: {
      description: 'Document not found'
    },
    500: {
      description: 'Internal server error'
    }
  }
)

// Register routes
routeRegistry.registerRoute('/api/v1/secure-download/{id}', 'GET')