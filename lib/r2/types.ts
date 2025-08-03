export interface R2FileMetadata {
  userId: string
  originalFilename: string
  uploadedAt: string
  enhancementId?: string
  documentType?: string
  [key: string]: string | undefined
}

export interface R2File {
  key: string
  url: string
  size: number
  contentType: string
  lastModified: Date
  metadata: R2FileMetadata
}

export interface UploadResult {
  success: boolean
  key: string
  url: string
  filename: string
  size: number
  type: string
}

export interface DownloadResult {
  success: boolean
  url: string
  expiresIn: number
}