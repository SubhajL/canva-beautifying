'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useWizardStore, UploadedFile } from '@/lib/stores/wizard-store';
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
import { useUsage } from '@/hooks/use-usage';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { validateFileIntegrity, sanitizeFilename } from '@/lib/utils/file-validation';
import { ErrorRetry } from '@/components/ui/error-retry';

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadStatus {
  id: string;
  name: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

export function UploadStep() {
  const { data, setError, clearError, addFiles, removeFile, updateFileStatus, clearFiles } = useWizardStore();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [lastUploadError, setLastUploadError] = useState<string | null>(null);
  const { trackFeature, trackEnhancement } = useBetaTracking();
  const { usage } = useUsage();
  
  // Debug logging
  console.log('UploadStep usage:', usage);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log('[Upload] onDrop called with files:', acceptedFiles.length);
    clearError('upload');
    setLastUploadError(null);
    
    if (acceptedFiles.length === 0) {
      console.log('[Upload] No files accepted');
      return;
    }

    // Handle multiple files
    const newUploadStatuses: UploadStatus[] = [];
    const validFiles: File[] = [];

    for (const file of acceptedFiles) {
      const sanitizedName = sanitizeFilename(file.name);
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Track file upload attempt
      trackFeature('file_upload', 'attempt', {
        fileType: file.type,
        fileSize: file.size,
        fileName: file.name,
      });

      // Create upload status
      const uploadStatus: UploadStatus = {
        id: fileId,
        name: sanitizedName,
        status: 'pending',
        progress: 0,
      };

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const error = 'File size must be less than 10MB';
        uploadStatus.status = 'error';
        uploadStatus.error = error;
        trackFeature('file_upload', 'error', {
          error: 'file_size_exceeded',
          fileSize: file.size,
        });
        newUploadStatuses.push(uploadStatus);
        continue;
      }

      // Validate file integrity
      const validation = await validateFileIntegrity(file);
      if (!validation.isValid) {
        const error = validation.error || 'File validation failed';
        uploadStatus.status = 'error';
        uploadStatus.error = error;
        trackFeature('file_upload', 'error', {
          error: 'file_validation_failed',
          details: validation.error,
        });
        newUploadStatuses.push(uploadStatus);
        continue;
      }

      // File is valid
      newUploadStatuses.push(uploadStatus);
      validFiles.push(file);
    }

    // Update upload statuses
    console.log('[Upload] Setting upload statuses:', newUploadStatuses);
    setUploadStatuses(newUploadStatuses);

    // If no valid files, show error
    if (validFiles.length === 0) {
      const errorMessages = newUploadStatuses
        .filter(s => s.error)
        .map(s => s.error)
        .filter((v, i, a) => a.indexOf(v) === i); // unique errors
      
      const mainError = errorMessages[0] || 'All files were rejected';
      setError('upload', mainError);
      setLastUploadError(mainError);
      toast.error(mainError);
      return;
    }

    // Process all valid files
    if (validFiles.length > 0) {
      setIsUploading(true);
      
      // Create UploadedFile objects and add to store
      const uploadedFiles: UploadedFile[] = validFiles.map(file => ({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        file,
        fileUrl: URL.createObjectURL(file),
        fileName: sanitizeFilename(file.name),
        fileType: file.type,
        fileSize: file.size,
        status: 'pending' as const,
        progress: 0,
      }));
      
      // Add files to store
      addFiles(uploadedFiles);
      
      // Upload files in parallel
      uploadedFiles.forEach(async (uploadedFile) => {
        // Start enhancement tracking
        trackEnhancement(uploadedFile.id, 'start', {
          fileType: uploadedFile.fileType,
          fileSize: uploadedFile.fileSize,
        });
        
        // Update status to uploading
        updateFileStatus(uploadedFile.id, 'uploading', { progress: 0 });
        
        try {
          // Create form data
          const formData = new FormData();
          formData.append('file', uploadedFile.file);
          
          // Upload file with progress tracking
          const xhr = new XMLHttpRequest();
          
          // Track upload progress
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              updateFileStatus(uploadedFile.id, 'uploading', { progress });
            }
          });
          
          // Create promise for upload
          const uploadPromise = new Promise<any>((resolve, reject) => {
            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const result = JSON.parse(xhr.responseText);
                  resolve(result);
                } catch (error) {
                  reject(new Error('Invalid response format'));
                }
              } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
              }
            });
            
            xhr.addEventListener('error', () => {
              reject(new Error('Network error during upload'));
            });
            
            xhr.addEventListener('abort', () => {
              reject(new Error('Upload cancelled'));
            });
          });
          
          // Start upload
          xhr.open('POST', '/api/upload');
          xhr.send(formData);
          
          const result = await uploadPromise;
          
          // Update file status with document ID
          updateFileStatus(uploadedFile.id, 'uploaded', {
            documentId: result.enhancementId,
            progress: 100,
          });
          
          trackFeature('file_upload', 'success', {
            fileType: uploadedFile.fileType,
            fileSize: uploadedFile.fileSize,
            documentId: result.enhancementId,
          });
        } catch (error) {
          console.error(`Failed to upload ${uploadedFile.fileName}:`, error);
          
          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          updateFileStatus(uploadedFile.id, 'error', {
            error: errorMessage,
          });
          
          trackFeature('file_upload', 'error', {
            error: errorMessage,
            fileName: uploadedFile.fileName,
          });
        }
      });
      
      // Clear upload statuses as we're now tracking in the store
      setUploadStatuses([]);
      setIsUploading(false);
    }
  }, [addFiles, updateFileStatus, setError, clearError, trackFeature, trackEnhancement]);

  const onDropRejected = useCallback((fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      const errors = rejection.errors;
      
      let errorMessage = 'File not supported';
      if (errors.some((e: any) => e.code === 'file-invalid-type')) {
        errorMessage = 'File type not supported. Please upload PDF, PowerPoint, or Word documents.';
      } else if (errors.some((e: any) => e.code === 'file-too-large')) {
        errorMessage = 'File size must be less than 10MB';
      }
      
      setError('upload', errorMessage);
      
      // Show toast notification
      toast.error(errorMessage);
      
      // Track rejection
      trackFeature('file_upload', 'rejected', {
        fileName: rejection.file.name,
        fileType: rejection.file.type,
        errors: errors.map((e: any) => e.code),
      });
    }
  }, [setError, trackFeature]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPTED_FILE_TYPES,
    maxFiles: 5, // Allow multiple files for batch error testing
    maxSize: MAX_FILE_SIZE,
    disabled: isUploading,
    multiple: true,
  });

  const handleRemoveFile = (fileId: string) => {
    removeFile(fileId);
  };

  const retryUpload = useCallback((fileId: string) => {
    // Clear errors and retry with the specific file
    clearError('upload');
    setLastUploadError(null);
    
    // Find the file and retry uploading it
    const fileToRetry = data.files.find(f => f.id === fileId);
    if (fileToRetry) {
      onDrop([fileToRetry.file]);
    }
  }, [data.files, onDrop, clearError]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Upload Your Document</h2>
        <p className="text-muted-foreground">
          Select a PDF, PowerPoint, or Word document to enhance
        </p>
      </div>

      {/* Usage Indicator */}
      {usage && (
        <div className="max-w-md mx-auto">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly enhancements</span>
              <span className="font-medium" data-testid="usage-counter">
                {usage.used} / {usage.limit === -1 ? '∞' : usage.limit}
              </span>
            </div>
            {usage.limit !== -1 && (
              <Progress value={usage.percentageUsed} className="h-2" />
            )}
          </div>
          
          {!usage.canEnhance && usage.limit > 0 && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription data-testid="upgrade-prompt">
                You&apos;ve reached your monthly enhancement limit. 
                <a href="/settings/billing" className="underline ml-1">
                  Upgrade to Pro
                </a>
              </AlertDescription>
            </Alert>
          )}
          
          {usage.percentageUsed >= 80 && usage.percentageUsed < 100 && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You&apos;ve used {Math.round(usage.percentageUsed)}% of your monthly credits
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {data.files.length === 0 ? (
        <div
          {...getRootProps()}
          data-testid="upload-dropzone"
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
          {/* Show all uploaded files */}
          {data.files.map((file, index) => (
            <div key={file.id} className="border rounded-lg p-4" data-testid={`file-preview-${index}`}>
              <div className="flex items-start justify-between">
                <div className="flex">
                  <FileText className="h-10 w-10 text-primary" />
                  <div className="ml-3 space-y-1 flex-1">
                    <p className="font-medium line-clamp-1">{file.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.fileSize)}
                    </p>
                    {file.status === 'uploaded' && (
                      <div className="flex items-center text-sm text-green-600" data-testid={`result-status-${index}`}>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span className="text-xs">Upload complete</span>
                      </div>
                    )}
                    {file.status === 'error' && file.error && (
                      <div className="mt-2">
                        <ErrorRetry
                          error={file.error}
                          onRetry={() => retryUpload(file.id)}
                          variant="destructive"
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFile(file.id)}
                  disabled={file.status === 'uploading'}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {file.status === 'uploading' && file.progress !== undefined && file.progress < 100 && (
                <div className="mt-4 space-y-2">
                  <Progress 
                    value={file.progress} 
                    data-testid={`file-progress-${index}`}
                    aria-valuenow={file.progress}
                    role="progressbar"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {file.progress}%
                  </p>
                </div>
              )}
            </div>
          ))}

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