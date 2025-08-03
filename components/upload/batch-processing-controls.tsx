'use client';

import React from 'react';
import { Play, Pause, X, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BatchFile } from '@/lib/stores/batch-upload-store';

interface BatchProcessingControlsProps {
  files: BatchFile[];
  selectedFiles: BatchFile[];
  isProcessing: boolean;
  totalProgress: number;
  onStartProcessing: () => void;
  onPauseProcessing: () => void;
  onCancelProcessing: () => void;
  onDownloadAll: () => void;
  onGenerateReport: () => void;
  disabled?: boolean;
}

export function BatchProcessingControls({
  files,
  selectedFiles,
  isProcessing,
  totalProgress,
  onStartProcessing,
  onPauseProcessing,
  onCancelProcessing,
  onDownloadAll,
  onGenerateReport,
  disabled = false,
}: BatchProcessingControlsProps) {
  const completedCount = files.filter(f => f.status === 'completed').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const processingCount = files.filter(f => 
    f.status === 'uploading' || f.status === 'processing'
  ).length;

  const canStartProcessing = selectedFiles.length > 0 && !isProcessing && !disabled;
  const canDownload = completedCount > 0;
  const canGenerateReport = files.length > 0 && (completedCount > 0 || errorCount > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Processing Controls</CardTitle>
        <CardDescription>
          Manage your batch enhancement process
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{totalProgress}%</span>
          </div>
          <Progress value={totalProgress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{completedCount} completed</span>
            <span>{processingCount} processing</span>
            <span>{errorCount} errors</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-2">
          {!isProcessing ? (
            <Button
              onClick={onStartProcessing}
              disabled={!canStartProcessing}
              className="flex-1 sm:flex-none"
            >
              <Play className="mr-2 h-4 w-4" />
              Start Processing ({selectedFiles.length})
            </Button>
          ) : (
            <>
              <Button
                onClick={onPauseProcessing}
                variant="secondary"
                className="flex-1 sm:flex-none"
              >
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button
                onClick={onCancelProcessing}
                variant="destructive"
                className="flex-1 sm:flex-none"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}

          <Button
            onClick={onDownloadAll}
            variant="outline"
            disabled={!canDownload}
            className="flex-1 sm:flex-none"
          >
            <Download className="mr-2 h-4 w-4" />
            Download All ({completedCount})
          </Button>

          <Button
            onClick={onGenerateReport}
            variant="outline"
            disabled={!canGenerateReport}
            className="flex-1 sm:flex-none"
          >
            <FileText className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-semibold">{files.length}</p>
            <p className="text-xs text-muted-foreground">Total Files</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-blue-600">{processingCount}</p>
            <p className="text-xs text-muted-foreground">Processing</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-green-600">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-red-600">{errorCount}</p>
            <p className="text-xs text-muted-foreground">Errors</p>
          </div>
        </div>

        {/* Processing Tips */}
        {isProcessing && (
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> You can safely navigate away from this page. 
              Processing will continue in the background, and you&apos;ll be notified when complete.
            </p>
          </div>
        )}

        {errorCount > 0 && (
          <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              <strong>Note:</strong> {errorCount} file{errorCount > 1 ? 's' : ''} failed to process. 
              Check the individual file status for details.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}