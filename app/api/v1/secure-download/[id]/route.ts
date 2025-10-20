import { NextRequest, NextResponse } from "next/server"
import {
  validateDownloadToken,
  logDownloadAccess,
} from "@/lib/api/download/token-validator"
import { errorResponse, apiErrors } from "@/lib/api/response"
import { getFileFromR2 } from "@/lib/r2/download"
import { R2NotConfiguredError } from "@/lib/storage/r2" // temporary type reuse if referenced elsewhere
import { generateFallbackPDF } from "@/lib/storage/fallback-pdf"
import { documentRoute } from "@/lib/api/openapi/decorators"
import { routeRegistry } from "@/lib/api/openapi/registry"

/**
 * Check if request is in E2E test mode with fake storage enabled.
 *
 * E2E tests can enable fallback PDF generation by setting these headers:
 * - x-e2e-mode: Indicates E2E test environment
 * - x-e2e-fake-storage: Signals that R2 storage should use fallback PDFs
 *
 * When both headers are present, the route returns a generated fallback PDF
 * instead of attempting to fetch from R2 storage. This allows E2E tests to
 * run without requiring real R2 credentials or file uploads.
 *
 * @param request - The incoming Next.js request
 * @returns true if both E2E headers are present, false otherwise
 */
function isE2EFakeMode(request: NextRequest): boolean {
  const e2eMode = request.headers.get("x-e2e-mode")
  const fakeStorage = request.headers.get("x-e2e-fake-storage")
  return !!(e2eMode && fakeStorage)
}

export const getSecureDownloadHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const documentId = params.id
    const useE2EFallback = isE2EFakeMode(request)

    // Validate download token
    const permission = await validateDownloadToken(request, documentId)

    if (!permission.canDownload) {
      await logDownloadAccess(documentId, permission.userId, false, {
        reason: permission.reason,
      })

      throw apiErrors.forbidden(permission.reason || "Download not permitted")
    }

    // Log successful access
    await logDownloadAccess(documentId, permission.userId, true)

    // Try to fetch file from storage
    let fileData: Awaited<ReturnType<typeof getFileFromR2>> = null

    try {
      fileData = await getFileFromR2(
        `enhanced/${permission.userId}/${documentId}`
      )
    } catch (error) {
      // Handle R2 not configured
      if (error instanceof R2NotConfiguredError) {
        if (useE2EFallback) {
          // Return fallback PDF in E2E mode
          const fallbackPDF = await generateFallbackPDF()
          return new NextResponse(fallbackPDF, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${documentId}.pdf"`,
              "Content-Length": fallbackPDF.length.toString(),
              "Cache-Control": "private, max-age=3600",
              "X-Content-Type-Options": "nosniff",
              "X-Frame-Options": "DENY",
            },
          })
        }

        // Return 501 Not Implemented when R2 is not configured
        return new NextResponse(
          JSON.stringify({
            error: "Storage Not Available",
            message: "File storage is not configured. Please contact support.",
          }),
          {
            status: 501,
            headers: { "Content-Type": "application/json" },
          }
        )
      }

      throw error
    }

    // File not found in storage
    if (!fileData) {
      if (useE2EFallback) {
        // Return fallback PDF in E2E mode
        const fallbackPDF = await generateFallbackPDF()
        return new NextResponse(fallbackPDF, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${documentId}.pdf"`,
            "Content-Length": fallbackPDF.length.toString(),
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
        })
      }

      throw apiErrors.notFound()
    }

    // Return file with appropriate headers
    return new NextResponse(fileData.Body, {
      headers: {
        "Content-Type": fileData.ContentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${documentId}.pdf"`,
        "Content-Length": fileData.ContentLength?.toString() || "0",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    })
  } catch (error) {
    console.error("Secure download error:", error)
    return errorResponse(error as Error)
  }
}

export const GET = documentRoute(
  getSecureDownloadHandler,
  {
    method: "GET",
    path: "/api/v1/secure-download/{id}",
    operationId: "secureDownloadFile",
    summary: "Download enhanced document",
    description:
      "Downloads an enhanced document with token-based authentication and access logging",
    tags: ["Downloads"],
  },
  undefined,
  {
    200: {
      description: "File download",
    },
    401: {
      description: "Unauthorized - Invalid or missing token",
    },
    403: {
      description: "Forbidden - Download not permitted",
    },
    404: {
      description: "Document not found",
    },
    500: {
      description: "Internal server error",
    },
  }
)

// Register routes
routeRegistry.registerRoute("/api/v1/secure-download/{id}", "GET")
