import * as React from "react"
import { cn } from "@/lib/utils"
import { Upload as UploadIcon, X, FileText, Image, File } from "lucide-react"
import { Button } from "./button"
import { Progress } from "./progress"

interface UploadProps extends React.HTMLAttributes<HTMLDivElement> {
  accept?: string
  multiple?: boolean
  maxSize?: number // in MB
  onFilesSelected?: (files: File[]) => void
  onFileRemove?: (index: number) => void
  files?: File[]
  uploading?: boolean
  uploadProgress?: number
  disabled?: boolean
}

const Upload = React.forwardRef<HTMLDivElement, UploadProps>(
  ({ 
    className, 
    accept,
    multiple = false,
    maxSize = 10,
    onFilesSelected,
    onFileRemove,
    files = [],
    uploading = false,
    uploadProgress = 0,
    disabled = false,
    ...props 
  }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    const [isDragging, setIsDragging] = React.useState(false)
    
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(true)
    }
    
    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
    }
    
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      
      const droppedFiles = Array.from(e.dataTransfer.files)
      handleFiles(droppedFiles)
    }
    
    const handleFiles = (selectedFiles: File[]) => {
      const validFiles = selectedFiles.filter(file => {
        const sizeMB = file.size / (1024 * 1024)
        return sizeMB <= maxSize
      })
      
      if (onFilesSelected) {
        onFilesSelected(validFiles)
      }
    }
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files)
        handleFiles(selectedFiles)
      }
    }
    
    const getFileIcon = (file: File) => {
      if (file.type.startsWith('image/')) return Image
      if (file.type.includes('pdf')) return FileText
      return File
    }
    
    const formatFileSize = (bytes: number) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
    
    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            "relative rounded-lg border-2 border-dashed p-8 text-center transition-all duration-base",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            uploading && "pointer-events-none"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileChange}
            disabled={disabled || uploading}
            className="hidden"
          />
          
          {uploading ? (
            <div className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <UploadIcon className="h-8 w-8 animate-pulse text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploading...</p>
                <Progress value={uploadProgress} className="mx-auto max-w-xs" />
                <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <UploadIcon className="h-8 w-8 text-primary" />
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">
                  Drop files here or click to upload
                </p>
                <p className="text-xs text-muted-foreground">
                  {accept ? `Accepted formats: ${accept}` : 'All file types accepted'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Max file size: {maxSize}MB
                </p>
              </div>
            </>
          )}
        </div>
        
        {files.length > 0 && !uploading && (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => {
              const FileIcon = getFileIcon(file)
              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  {onFileRemove && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onFileRemove(index)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }
)
Upload.displayName = "Upload"

export { Upload }