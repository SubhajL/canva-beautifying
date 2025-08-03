'use client';

import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UploadDropzone } from '@/components/upload/upload-dropzone';
import { BatchPreviewGrid } from '@/components/upload/batch-preview-grid';
import { BatchProcessingControls } from '@/components/upload/batch-processing-controls';
import { BatchProgressTracker } from '@/components/upload/batch-progress-tracker';
import { useFileUploadEnhanced } from '@/hooks/use-file-upload-enhanced';
import { Button } from '@/components/ui/button';
import { AlertCircle, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { UsageIndicator } from '@/components/subscription/usage-indicator';
import { useSubscription } from '@/hooks/use-subscription';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InlineUpsellCard } from '@/components/usage/upsell-prompt';
import { CanvaImport } from '@/components/upload/canva-import';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBatchUploadStore } from '@/lib/stores/batch-upload-store';
import { downloadBatch, generateBatchReport } from '@/lib/utils/batch-download';
import { useToast } from '@/hooks/use-toast';
import { useSocket } from '@/hooks/use-socket';

export default function BatchUploadPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { hasCredits, getMaxFileSize, getBatchLimit } = useSubscription();
  const { toast } = useToast();
  const { socket } = useSocket();
  
  const {
    files,
    batchId,
    isProcessing,
    totalProgress,
    addFiles,
    removeFile,
    toggleFileSelection,
    selectAll,
    deselectAll,
    updateFileStatus,
    updateFileProgress,
    updateFileData,
    getSelectedFiles,
    clearBatch,
    setBatchId,
    setProcessing,
  } = useBatchUploadStore();

  const { uploadFiles } = useFileUploadEnhanced({
    onSuccess: (id, result) => {
      // Update file with upload result
      const file = files.find(f => f.id === id);
      if (file) {
        updateFileData(id, {
          status: 'uploaded',
          enhancementId: result.id,
          uploadedUrl: result.url,
        });
      }
    },
    onError: (id, error) => {
      updateFileStatus(id, 'error', error);
    },
    onProgress: (id, progress) => {
      updateFileProgress(id, progress);
    },
  });

  // WebSocket event handlers
  useEffect(() => {
    if (!socket || !batchId) return;

    // Join batch room for updates
    socket.emit('join-batch', batchId);

    // Handle batch progress updates
    socket.on('batch-progress', (data: { fileId: string; progress: number }) => {
      if (data.fileId && data.progress !== undefined) {
        updateFileProgress(data.fileId, data.progress);
      }
    });

    // Handle file status updates
    socket.on('file-status', (data: { fileId: string; status: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'completed' | 'error'; error?: string; enhancedUrl?: string }) => {
      if (data.fileId && data.status) {
        updateFileStatus(data.fileId, data.status, data.error);
        if (data.enhancedUrl) {
          updateFileData(data.fileId, { enhancedUrl: data.enhancedUrl });
        }
      }
    });

    // Handle batch completion
    socket.on('batch-complete', (data: { completedCount: number; totalCount: number }) => {
      setProcessing(false);
      toast({
        title: 'Batch Processing Complete',
        description: `${data.completedCount} of ${data.totalCount} files enhanced successfully.`,
      });
    });

    return () => {
      socket.emit('leave-batch', batchId);
      socket.off('batch-progress');
      socket.off('file-status');
      socket.off('batch-complete');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, batchId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    // Validate batch size
    const currentCount = files.length;
    const batchLimit = getBatchLimit();
    
    if (currentCount + newFiles.length > batchLimit) {
      toast({
        title: 'Batch limit exceeded',
        description: `You can only process ${batchLimit} files at once. Currently have ${currentCount} files.`,
        variant: 'destructive',
      });
      
      // Only add files up to the limit
      const filesToAdd = newFiles.slice(0, batchLimit - currentCount);
      if (filesToAdd.length > 0) {
        addFiles(filesToAdd);
      }
      return;
    }

    addFiles(newFiles);
  }, [files.length, getBatchLimit, addFiles, toast]);

  const handleStartProcessing = async () => {
    const selectedFiles = getSelectedFiles();
    
    if (selectedFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one file to process.',
        variant: 'destructive',
      });
      return;
    }

    // Check credits
    if (!hasCredits()) {
      toast({
        title: 'Insufficient credits',
        description: `You need ${selectedFiles.length} credits to process these files.`,
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      // First, upload any pending files
      const pendingFiles = selectedFiles.filter(f => f.status === 'pending');
      if (pendingFiles.length > 0) {
        await uploadFiles(pendingFiles.map(f => f.file));
      }

      // Wait for uploads to complete
      await new Promise(resolve => {
        const checkUploads = setInterval(() => {
          const uploadingCount = files.filter(f => 
            f.selected && f.status === 'uploading'
          ).length;
          
          if (uploadingCount === 0) {
            clearInterval(checkUploads);
            resolve(true);
          }
        }, 500);
      });

      // Get enhancement IDs for uploaded files
      const enhancementIds = selectedFiles
        .filter(f => f.enhancementId)
        .map(f => f.enhancementId as string);

      if (enhancementIds.length === 0) {
        throw new Error('No files were successfully uploaded');
      }

      // Start batch processing
      const response = await fetch('/api/v1/enhance/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileIds: enhancementIds,
          options: {
            priority: 'normal',
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start batch processing');
      }

      const result = await response.json();
      setBatchId(result.batchId);

      // Update file statuses to processing
      enhancementIds.forEach(id => {
        const file = files.find(f => f.enhancementId === id);
        if (file) {
          updateFileStatus(file.id, 'processing');
        }
      });

      toast({
        title: 'Batch processing started',
        description: `Processing ${enhancementIds.length} files. You can track progress below.`,
      });

    } catch (error) {
      console.error('Batch processing error:', error);
      setProcessing(false);
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Failed to start batch processing',
        variant: 'destructive',
      });
    }
  };

  const handlePauseProcessing = () => {
    // TODO: Implement pause functionality
    toast({
      title: 'Feature coming soon',
      description: 'Pause functionality will be available in the next update.',
    });
  };

  const handleCancelProcessing = () => {
    setProcessing(false);
    // TODO: Send cancel request to API
    toast({
      title: 'Processing cancelled',
      description: 'Batch processing has been cancelled.',
    });
  };

  const handleDownloadAll = async () => {
    const completedFiles = files.filter(f => f.status === 'completed' && f.enhancedUrl);
    
    if (completedFiles.length === 0) {
      toast({
        title: 'No files to download',
        description: 'No enhanced files are ready for download.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const downloadFiles = completedFiles.map(f => ({
        id: f.id,
        fileName: f.file.name.replace(/\.[^/.]+$/, '_enhanced$&'),
        url: f.enhancedUrl!,
        type: 'enhanced' as const,
      }));

      await downloadBatch(
        downloadFiles,
        `beautifyai_batch_${new Date().getTime()}.zip`,
        (progress, fileName) => {
          console.log(`Downloading ${fileName}: ${progress}%`);
        }
      );

      toast({
        title: 'Download complete',
        description: `Downloaded ${completedFiles.length} enhanced files.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download failed',
        description: 'Failed to download files. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateReport = () => {
    const reportData = files.map(f => ({
      id: f.id,
      fileName: f.file.name,
      status: f.status,
      processingTime: 0, // TODO: Track actual processing time
      error: f.error,
      enhancementDetails: {}, // TODO: Get enhancement details from API
    }));

    generateBatchReport(
      reportData,
      `beautifyai_report_${new Date().getTime()}.csv`
    );

    toast({
      title: 'Report generated',
      description: 'Batch processing report has been downloaded.',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Batch Document Enhancement</h1>
        <p className="text-lg text-muted-foreground">
          Upload multiple documents and enhance them all at once.
          Process up to {getBatchLimit()} files in a single batch.
        </p>
      </div>

      {/* Usage Indicator */}
      <div className="max-w-sm mx-auto space-y-4">
        <UsageIndicator />
        <InlineUpsellCard />
      </div>

      {/* Credits Warning */}
      {!hasCredits() && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You&apos;ve used all your monthly credits. Please upgrade your plan to continue enhancing documents.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload and File Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Options */}
          {files.length === 0 || !isProcessing ? (
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Upload Files</TabsTrigger>
                <TabsTrigger value="canva">Import from Canva</TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="mt-6">
                <UploadDropzone 
                  onUpload={handleFilesAdded} 
                  config={{
                    maxFiles: getBatchLimit() - files.length,
                    maxFileSize: getMaxFileSize() * 1024 * 1024
                  }}
                  className={!hasCredits() || isProcessing ? "opacity-50 pointer-events-none" : ""}
                />
              </TabsContent>
              
              <TabsContent value="canva" className="mt-6">
                <CanvaImport 
                  onImport={async (file) => {
                    await handleFilesAdded([file]);
                  }}
                  disabled={!hasCredits() || isProcessing}
                />
              </TabsContent>
            </Tabs>
          ) : null}

          {/* File Preview Grid */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Uploaded Files</h2>
                {!isProcessing && files.length < getBatchLimit() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Show upload interface again
                      const uploadTab = document.querySelector('[value="upload"]');
                      if (uploadTab) {
                        (uploadTab as HTMLElement).click();
                      }
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Add More Files
                  </Button>
                )}
              </div>
              
              <BatchPreviewGrid
                files={files}
                onRemove={removeFile}
                onToggleSelect={toggleFileSelection}
                onSelectAll={selectAll}
                onDeselectAll={deselectAll}
                readOnly={isProcessing}
              />
            </div>
          )}
        </div>

        {/* Right Column: Controls and Progress */}
        <div className="space-y-6">
          {/* Processing Controls */}
          {files.length > 0 && (
            <BatchProcessingControls
              files={files}
              selectedFiles={getSelectedFiles()}
              isProcessing={isProcessing}
              totalProgress={totalProgress}
              onStartProcessing={handleStartProcessing}
              onPauseProcessing={handlePauseProcessing}
              onCancelProcessing={handleCancelProcessing}
              onDownloadAll={handleDownloadAll}
              onGenerateReport={handleGenerateReport}
              disabled={!hasCredits()}
            />
          )}

          {/* Progress Tracker */}
          {files.length > 0 && (
            <BatchProgressTracker files={files} />
          )}
        </div>
      </div>

      {/* Clear Batch Button */}
      {files.length > 0 && !isProcessing && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Are you sure you want to clear all files?')) {
                clearBatch();
              }
            }}
          >
            Clear All Files
          </Button>
        </div>
      )}
    </div>
  );
}