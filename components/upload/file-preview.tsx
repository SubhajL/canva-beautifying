"use client"

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { FileUpload } from './types'
import { FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FilePreviewProps {
  upload: FileUpload
  onRemove: (id: string) => void
}

export function FilePreview({ upload, onRemove }: FilePreviewProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [pdfInfo, setPdfInfo] = useState<{ name: string; pages?: number } | null>(null)

  useEffect(() => {
    if (upload.file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(upload.file)
    } else if (upload.file.type === 'application/pdf') {
      // For PDFs, we'll show file info instead of preview
      // In production, you might want to generate thumbnails server-side
      setPdfInfo({
        name: upload.file.name,
        pages: undefined // Could be extracted with pdf.js if needed
      })
    }
  }, [upload.file])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="relative p-4 border rounded-lg bg-card">
      <div className="flex items-start gap-4">
        {/* Preview */}
        <div className="w-20 h-20 flex-shrink-0">
          {preview ? (
            <Image
              src={preview}
              alt={upload.file.name}
              width={80}
              height={80}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted rounded">
              <div className="text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
                {pdfInfo && (
                  <span className="text-xs font-semibold mt-1 block">PDF</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">{upload.file.name}</h4>
          <p className="text-xs text-muted-foreground mt-1">
            {formatFileSize(upload.file.size)}
            {pdfInfo && ' • PDF Document'}
          </p>

          {/* Progress Bar */}
          {upload.status === 'uploading' && (
            <div className="mt-2">
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {upload.progress}% uploaded
              </p>
            </div>
          )}

          {/* Status */}
          {upload.status === 'success' && (
            <div className="flex items-center gap-1 mt-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">Upload complete</span>
            </div>
          )}

          {upload.status === 'error' && (
            <div className="flex items-center gap-1 mt-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">{upload.error || 'Upload failed'}</span>
            </div>
          )}
        </div>

        {/* Remove Button */}
        {upload.status !== 'uploading' && (
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