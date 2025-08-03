"use client"

import React, { useState } from "react"
import { useFileUpload } from "@/hooks/use-file-upload"
import { Button } from "@/components/ui/button"

export function R2UploadTest() {
  const { uploads, isUploading, uploadFile, clearUploads } = useFileUpload()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    
    try {
      await uploadFile(selectedFile)
      setSelectedFile(null)
    } catch (error) {
      console.error("Upload failed:", error)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">R2 Upload Test</h2>
      
      <div className="space-y-2">
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,application/pdf"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-primary file:text-primary-foreground
            hover:file:bg-primary/90"
        />
        
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? "Uploading..." : "Upload File"}
        </Button>
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Upload History</h3>
            <Button variant="outline" size="sm" onClick={clearUploads}>
              Clear
            </Button>
          </div>
          
          {uploads.map((upload, index) => (
            <div key={index} className="p-2 border rounded space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{upload.file.name}</span>
                <span className="text-sm text-muted-foreground">
                  {upload.status}
                </span>
              </div>
              
              {upload.status === "uploading" && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
              
              {upload.status === "success" && upload.result && (
                <div className="text-xs text-muted-foreground">
                  <p>Key: {upload.result.key}</p>
                  <a
                    href={upload.result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View File
                  </a>
                </div>
              )}
              
              {upload.status === "error" && (
                <p className="text-xs text-destructive">{upload.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}