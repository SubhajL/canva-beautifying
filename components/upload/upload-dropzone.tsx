"use client"

import React, { useCallback, useState, useMemo } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { Upload, Image, FileText } from 'lucide-react'
import { FileUpload, UploadConfig } from './types'
import { FilePreview } from './file-preview'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner';
import { useLiveRegion } from '@/components/a11y/live-region';

const DEFAULT_CONFIG: UploadConfig = {
  maxFiles: 10,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  acceptedFileTypes: ['.png', '.jpg', '.jpeg', '.pdf'],
  acceptedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'],
}

interface UploadDropzoneProps {
  onUpload: (files: File[]) => Promise<void>
  config?: Partial<UploadConfig>
  className?: string
}

export function UploadDropzone({ 
  onUpload, 
  config: userConfig,
  className 
}: UploadDropzoneProps) {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig])
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const { announce } = useLiveRegion();

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    const validateFile = (file: File): string | null => {
      // Check file type
      if (!config.acceptedMimeTypes.includes(file.type)) {
        return `File type not supported. Please upload ${config.acceptedFileTypes.join(', ')} files.`
      }

      // Check file size
      if (file.size > config.maxFileSize) {
        return `File size exceeds 50MB limit.`
      }

      // Check total files
      if (uploads.length >= config.maxFiles) {
        return `Maximum ${config.maxFiles} files allowed.`
      }

      return null
    }
    // Handle rejected files
    rejectedFiles.forEach((rejection) => {
      const error = rejection.errors[0]?.message || 'File rejected'
      toast.error(error)
      announce(`Error: ${error}`, 'assertive')
    })

    // Validate accepted files
    const newUploads: FileUpload[] = []
    
    for (const file of acceptedFiles) {
      const error = validateFile(file)
      
      if (error) {
        toast.error(error)
        announce(`Error: ${error}`, 'assertive')
        continue
      }

      const upload: FileUpload = {
        id: `${file.name}-${Date.now()}`,
        file,
        progress: 0,
        status: 'pending',
      }
      
      newUploads.push(upload)
    }

    if (newUploads.length === 0) return

    // Announce successful file selection
    announce(`${newUploads.length} file${newUploads.length > 1 ? 's' : ''} selected for upload`, 'polite')

    // Add to uploads
    setUploads(prev => [...prev, ...newUploads])

    // Start uploading
    setIsUploading(true)
    
    try {
      await onUpload(newUploads.map(u => u.file))
      
      // Update status to success
      setUploads(prev => prev.map(u => {
        const uploaded = newUploads.find(nu => nu.id === u.id)
        if (uploaded) {
          return { ...u, status: 'success', progress: 100 }
        }
        return u
      }))
      
      announce(`Upload complete for ${newUploads.length} file${newUploads.length > 1 ? 's' : ''}`, 'assertive')
    } catch (error) {
      // Update status to error
      setUploads(prev => prev.map(u => {
        const uploaded = newUploads.find(nu => nu.id === u.id)
        if (uploaded) {
          return { 
            ...u, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Upload failed' 
          }
        }
        return u
      }))
      
      announce('Upload failed. Please try again.', 'assertive')
    } finally {
      setIsUploading(false)
    }
  }, [uploads.length, config, onUpload, announce])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: config.maxFiles - uploads.length,
    maxSize: config.maxFileSize,
    disabled: isUploading || uploads.length >= config.maxFiles,
  })

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id))
  }

  const clearAll = () => {
    setUploads([])
  }

  const hasUploads = uploads.length > 0

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Dropzone */}
      {!hasUploads || uploads.length < config.maxFiles ? (
        <div
          {...getRootProps()}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 transition-all",
            "hover:border-primary hover:bg-accent/50",
            isDragActive && "border-primary bg-accent",
            (isUploading || uploads.length >= config.maxFiles) && "opacity-50 cursor-not-allowed",
            !isUploading && uploads.length < config.maxFiles && "cursor-pointer"
          )}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold">
                {isDragActive ? "Drop files here" : "Drag & drop files here"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse from your computer
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image className="w-4 h-4" aria-hidden="true" />
                <span>PNG, JPG</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>PDF</span>
              </div>
              <span>•</span>
              <span>Max 50MB</span>
              <span>•</span>
              <span>{uploads.length}/{config.maxFiles} files</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* File List */}
      {hasUploads && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Uploaded Files ({uploads.length}/{config.maxFiles})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={isUploading}
            >
              Clear All
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {uploads.map((upload) => (
              <FilePreview
                key={upload.id}
                upload={upload}
                onRemove={removeUpload}
              />
            ))}
          </div>

          {uploads.length < config.maxFiles && (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center transition-all",
                "hover:border-primary hover:bg-accent/50",
                isDragActive && "border-primary bg-accent",
                isUploading && "opacity-50 cursor-not-allowed",
                !isUploading && "cursor-pointer"
              )}
            >
              <input {...getInputProps()} />
              <p className="text-sm text-muted-foreground">
                Add more files (up to {config.maxFiles - uploads.length} more)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}