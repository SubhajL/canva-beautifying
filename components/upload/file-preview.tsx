"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { FileUpload } from "./types"
import { FileText, X, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FilePreviewProps {
  upload: FileUpload
  onRemove: (id: string) => void
}

export function FilePreview({ upload, onRemove }: FilePreviewProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [pdfInfo, setPdfInfo] = useState<{
    name: string
    pages?: number
  } | null>(null)

  useEffect(() => {
    if (upload.file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(upload.file)
    } else if (upload.file.type === "application/pdf") {
      // For PDFs, we'll show file info instead of preview
      // In production, you might want to generate thumbnails server-side
      setPdfInfo({
        name: upload.file.name,
        pages: undefined, // Could be extracted with pdf.js if needed
      })
    }
  }, [upload.file])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="relative rounded-lg border bg-card p-4">
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="h-20 w-20 flex-shrink-0">
          {preview ? (
            <Image
              src={preview}
              alt={upload.file.name}
              width={80}
              height={80}
              className="h-full w-full rounded object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded bg-muted">
              <div className="text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                {pdfInfo && (
                  <span className="mt-1 block text-xs font-semibold">PDF</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium">{upload.file.name}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatFileSize(upload.file.size)}
            {pdfInfo && " • PDF Document"}
          </p>

          {/* Progress Bar */}
          {upload.status === "uploading" && (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {upload.progress}% uploaded
              </p>
            </div>
          )}

          {/* Status */}
          {upload.status === "success" && (
            <div className="mt-2 flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">Upload complete</span>
            </div>
          )}

          {upload.status === "error" && (
            <div className="mt-2 flex items-center gap-1 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">{upload.error || "Upload failed"}</span>
            </div>
          )}
        </div>

        {/* Remove Button */}
        {upload.status !== "uploading" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onRemove(upload.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
