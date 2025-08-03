export interface FileUpload {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  preview?: string
  result?: {
    key: string
    url: string
  }
}

export interface UploadConfig {
  maxFiles: number
  maxFileSize: number
  acceptedFileTypes: string[]
  acceptedMimeTypes: string[]
}