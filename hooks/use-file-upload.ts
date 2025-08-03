import { useState, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"

interface UploadProgress {
  file: File
  progress: number
  status: "pending" | "uploading" | "success" | "error"
  error?: string
  result?: {
    key: string
    url: string
  }
}

export function useFileUpload() {
  const { user } = useAuth()
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map())
  const [isUploading, setIsUploading] = useState(false)

  const uploadFile = useCallback(async (file: File) => {
    const uploadId = `${file.name}-${Date.now()}`
    
    setUploads(prev => new Map(prev).set(uploadId, {
      file,
      progress: 0,
      status: "pending"
    }))

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      
      // Only include userId if user is authenticated
      if (user?.id) {
        formData.append("userId", user.id)
      }

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setUploads(prev => {
            const newMap = new Map(prev)
            const upload = newMap.get(uploadId)
            if (upload) {
              newMap.set(uploadId, { ...upload, progress, status: "uploading" })
            }
            return newMap
          })
        }
      })

      const response = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error(xhr.responseText))
          }
        }
        xhr.onerror = () => reject(new Error("Network error"))
        
        xhr.open("POST", "/api/upload")
        xhr.send(formData)
      })

      setUploads(prev => {
        const newMap = new Map(prev)
        const upload = newMap.get(uploadId)
        if (upload) {
          newMap.set(uploadId, {
            ...upload,
            progress: 100,
            status: "success",
            result: {
              key: response.key,
              url: response.url
            }
          })
        }
        return newMap
      })

      return response
    } catch (error) {
      setUploads(prev => {
        const newMap = new Map(prev)
        const upload = newMap.get(uploadId)
        if (upload) {
          newMap.set(uploadId, {
            ...upload,
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed"
          })
        }
        return newMap
      })
      throw error
    } finally {
      setIsUploading(false)
    }
  }, [])

  const uploadFiles = useCallback(async (files: File[]) => {
    const results = await Promise.allSettled(
      files.map(file => uploadFile(file))
    )
    return results
  }, [uploadFile])

  const clearUploads = useCallback(() => {
    setUploads(new Map())
  }, [])

  return {
    uploads: Array.from(uploads.values()),
    isUploading,
    uploadFile,
    uploadFiles,
    clearUploads,
  }
}