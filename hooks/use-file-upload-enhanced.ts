import { useState, useCallback, useRef } from 'react'
import { FileUpload } from '@/components/upload/types'
import { useAuth } from '@/contexts/auth-context'

interface UseFileUploadEnhancedOptions {
  endpoint?: string
  onProgress?: (id: string, progress: number) => void
  onSuccess?: (id: string, result: any) => void
  onError?: (id: string, error: string) => void
}

export function useFileUploadEnhanced(options: UseFileUploadEnhancedOptions = {}) {
  const { 
    endpoint = '/api/upload',
    onProgress,
    onSuccess,
    onError 
  } = options

  const { user } = useAuth()
  const [uploads, setUploads] = useState<Map<string, FileUpload>>(new Map())
  const [isUploading, setIsUploading] = useState(false)
  const xhrMap = useRef<Map<string, XMLHttpRequest>>(new Map())

  const updateUpload = useCallback((id: string, updates: Partial<FileUpload>) => {
    setUploads(prev => {
      const newMap = new Map(prev)
      const upload = newMap.get(id)
      if (upload) {
        newMap.set(id, { ...upload, ...updates })
      }
      return newMap
    })
  }, [])

  const uploadFile = useCallback(async (file: File): Promise<any> => {
    const uploadId = `${file.name}-${Date.now()}`
    
    // Initialize upload
    const upload: FileUpload = {
      id: uploadId,
      file,
      progress: 0,
      status: 'pending',
    }
    
    setUploads(prev => new Map(prev).set(uploadId, upload))
    setIsUploading(true)

    // Update to uploading status
    updateUpload(uploadId, { status: 'uploading' })

    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)
      
      // Only include userId if user is authenticated
      if (user?.id) {
        formData.append('userId', user.id)
      }

      const xhr = new XMLHttpRequest()
      xhrMap.current.set(uploadId, xhr)

      // Progress handler
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          updateUpload(uploadId, { progress })
          onProgress?.(uploadId, progress)
        }
      })

      // Load handler
      xhr.addEventListener('load', () => {
        xhrMap.current.delete(uploadId)
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            updateUpload(uploadId, {
              status: 'success',
              progress: 100,
              result: {
                key: response.key,
                url: response.url,
              }
            })
            onSuccess?.(uploadId, response)
            resolve(response)
          } catch (error) {
            const errorMsg = 'Invalid response from server'
            updateUpload(uploadId, { status: 'error', error: errorMsg })
            onError?.(uploadId, errorMsg)
            reject(new Error(errorMsg))
          }
        } else {
          const errorMsg = `Upload failed: ${xhr.statusText}`
          updateUpload(uploadId, { status: 'error', error: errorMsg })
          onError?.(uploadId, errorMsg)
          reject(new Error(errorMsg))
        }
      })

      // Error handler
      xhr.addEventListener('error', () => {
        xhrMap.current.delete(uploadId)
        const errorMsg = 'Network error occurred'
        updateUpload(uploadId, { status: 'error', error: errorMsg })
        onError?.(uploadId, errorMsg)
        reject(new Error(errorMsg))
      })

      // Abort handler
      xhr.addEventListener('abort', () => {
        xhrMap.current.delete(uploadId)
        updateUpload(uploadId, { status: 'error', error: 'Upload cancelled' })
        reject(new Error('Upload cancelled'))
      })

      // Send request
      xhr.open('POST', endpoint)
      xhr.send(formData)
    }).finally(() => {
      // Check if all uploads are complete
      const allComplete = Array.from(uploads.values()).every(
        u => u.status === 'success' || u.status === 'error'
      )
      if (allComplete) {
        setIsUploading(false)
      }
    })
  }, [endpoint, updateUpload, onProgress, onSuccess, onError, uploads])

  const uploadFiles = useCallback(async (files: File[]) => {
    const results = await Promise.allSettled(
      files.map(file => uploadFile(file))
    )
    return results
  }, [uploadFile])

  const cancelUpload = useCallback((id: string) => {
    const xhr = xhrMap.current.get(id)
    if (xhr) {
      xhr.abort()
      xhrMap.current.delete(id)
    }
  }, [])

  const removeUpload = useCallback((id: string) => {
    cancelUpload(id)
    setUploads(prev => {
      const newMap = new Map(prev)
      newMap.delete(id)
      return newMap
    })
  }, [cancelUpload])

  const clearUploads = useCallback(() => {
    // Cancel all ongoing uploads
    xhrMap.current.forEach(xhr => xhr.abort())
    xhrMap.current.clear()
    setUploads(new Map())
    setIsUploading(false)
  }, [])

  return {
    uploads: Array.from(uploads.values()),
    isUploading,
    uploadFile,
    uploadFiles,
    cancelUpload,
    removeUpload,
    clearUploads,
  }
}