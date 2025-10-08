import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { validateDownloadToken, logDownloadAccess } from '@/lib/api/download/token-validator'
import { errorResponse, apiErrors } from '@/lib/api/response'
import { getFileFromR2, R2NotConfiguredError } from '@/lib/storage/r2'
import { ApiError } from '@/lib/api/response'
import { documentRoute } from '@/lib/api/openapi/decorators'
import { routeRegistry } from '@/lib/api/openapi/registry'

function isE2ETestMode(req: NextRequest): boolean {
  return (
    process.env.NODE_ENV !== 'production' && (
      req.headers.get('x-e2e-test-mode') === '1' ||
      req.headers.get('x-e2e-test-mode') === 'true' ||
      process.env.E2E_TEST_MODE === 'true'
    )
  )
}

function allowFakeDownload(req: NextRequest): boolean {
  return (
    req.headers.get('x-e2e-storage-fake') === '1' ||
    req.headers.get('x-e2e-storage-fake') === 'true' ||
    process.env.E2E_STORAGE_FAKE_DOWNLOAD === 'true'
  )
}

async function generateFallbackPdf(docId: string) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([300, 200])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const { width, height } = page.getSize()
  const fontSize = 12
  const text = `E2E Fallback Document\nID: ${docId}`
  page.drawText(text, {
    x: 24,
    y: height - 48,
    size: fontSize,
    font,
  })
  const bytes = await pdf.save()
  return Buffer.from(bytes)
}

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
      if (isE2ETestMode(request) && allowFakeDownload(request)) {
        // E2E fallback: return a tiny PDF when storage is not populated
        const pdf = await generateFallbackPdf(documentId)
        return new NextResponse(pdf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${documentId}.pdf"`,
            'Content-Length': String(pdf.length),
            'Cache-Control': 'no-store',
          }
        })
      }
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
    if (error instanceof R2NotConfiguredError) {
      if (isE2ETestMode(request) && allowFakeDownload(request)) {
        const pdf = await generateFallbackPdf((request as any).params?.id || 'file')
        return new NextResponse(pdf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${(request as any).params?.id || 'file'}.pdf"`,
            'Content-Length': String(pdf.length),
            'Cache-Control': 'no-store',
          }
        })
      }
      return errorResponse(new ApiError('NOT_IMPLEMENTED', 'R2 storage not configured', 501))
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
