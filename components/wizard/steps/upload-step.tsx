'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useWizardStore } from '@/lib/stores/wizard-store';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Upload, 
  X, 
  CheckCircle,
  AlertCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/utils/format';
import { useBetaTracking } from '@/lib/tracking/beta-usage-tracker';

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function UploadStep() {
  const { data, updateData, setError, clearError } = useWizardStore();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const { trackFeature, trackEnhancement } = useBetaTracking();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    clearError('upload');
    
    if (acceptedFiles.length === 0) {
      return;
    }

    const file = acceptedFiles[0];

    // Track file upload attempt
    trackFeature('file_upload', 'attempt', {
      fileType: file.type,
      fileSize: file.size,
      fileName: file.name,
    });

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('upload', 'File size must be less than 10MB');
      trackFeature('file_upload', 'error', {
        error: 'file_size_exceeded',
        fileSize: file.size,
      });
      return;
    }

    // Start enhancement tracking
    const documentId = `doc_${Date.now()}`;
    trackEnhancement(documentId, 'start', {
      fileType: file.type,
      fileSize: file.size,
    });

    // Simulate file upload progress
    setIsUploading(true);
    setUploadProgress(0);

    // Create file preview URL
    const fileUrl = URL.createObjectURL(file);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Update store with file data
    setTimeout(() => {
      updateData({
        file,
        fileUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      setIsUploading(false);
      clearInterval(progressInterval);
    }, 2000);
  }, [updateData, setError, clearError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 1,
    disabled: isUploading,
  });

  const removeFile = () => {
    if (data.fileUrl) {
      URL.revokeObjectURL(data.fileUrl);
    }
    updateData({
      file: null,
      fileUrl: null,
      fileName: null,
      fileType: null,
      fileSize: null,
    });
    setUploadProgress(0);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Upload Your Document</h2>
        <p className="text-muted-foreground">
          Select a PDF, PowerPoint, or Word document to enhance
        </p>
      </div>

      {!data.file ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
            isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30",
            isUploading && "opacity-50 cursor-not-allowed"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">
            {isDragActive ? "Drop your file here" : "Drag & drop your file here"}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse from your computer
          </p>
          <Button variant="outline" disabled={isUploading}>
            Select File
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Supported formats: PDF, PPT, PPTX, DOC, DOCX (Max 10MB)
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <FileText className="h-10 w-10 text-primary mt-1" />
                <div className="space-y-1">
                  <p className="font-medium line-clamp-1">{data.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(data.fileSize || 0)}
                  </p>
                  {uploadProgress === 100 && (
                    <div className="flex items-center text-sm text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Upload complete
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={removeFile}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isUploading && uploadProgress < 100 && (
              <div className="mt-4 space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-xs text-muted-foreground text-center">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}
          </div>

          <div className="flex items-start space-x-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Your document will be securely processed. We do not store any personal information
              contained in your files.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}