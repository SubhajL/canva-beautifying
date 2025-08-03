'use client';

import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Clock, FileText } from 'lucide-react';
import { BatchFile } from '@/lib/stores/batch-upload-store';
import { cn } from '@/lib/utils';

interface BatchProgressTrackerProps {
  files: BatchFile[];
  className?: string;
}

interface FileProgress {
  fileId: string;
  fileName: string;
  status: BatchFile['status'];
  progress: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export function BatchProgressTracker({ files, className }: BatchProgressTrackerProps) {
  const [fileProgress, setFileProgress] = useState<Record<string, FileProgress>>({});

  useEffect(() => {
    // Initialize or update file progress
    const newProgress: Record<string, FileProgress> = {};
    
    files.forEach(file => {
      const existing = fileProgress[file.id];
      newProgress[file.id] = {
        fileId: file.id,
        fileName: file.file.name,
        status: file.status,
        progress: file.progress,
        error: file.error,
        startTime: existing?.startTime || 
          (file.status !== 'pending' ? Date.now() : undefined),
        endTime: existing?.endTime || 
          (file.status === 'completed' || file.status === 'error' ? Date.now() : undefined),
      };
    });

    setFileProgress(newProgress);
  }, [files]);

  const getStatusIcon = (status: BatchFile['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'uploaded':
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: BatchFile['status']) => {
    const variants: Record<BatchFile['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      uploading: 'default',
      uploaded: 'secondary',
      processing: 'default',
      completed: 'secondary',
      error: 'destructive',
    };

    const labels: Record<BatchFile['status'], string> = {
      pending: 'Pending',
      uploading: 'Uploading',
      uploaded: 'Uploaded',
      processing: 'Processing',
      completed: 'Completed',
      error: 'Error',
    };

    return (
      <Badge variant={variants[status]} className="text-xs">
        {labels[status]}
      </Badge>
    );
  };

  const getElapsedTime = (startTime?: number, endTime?: number) => {
    if (!startTime) return '';
    
    const end = endTime || Date.now();
    const elapsed = Math.floor((end - startTime) / 1000);
    
    if (elapsed < 60) return `${elapsed}s`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
    return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
  };

  const sortedFiles = [...files].sort((a, b) => {
    // Sort by status priority: processing > uploading > error > completed > uploaded > pending
    const statusPriority: Record<BatchFile['status'], number> = {
      processing: 0,
      uploading: 1,
      error: 2,
      completed: 3,
      uploaded: 4,
      pending: 5,
    };
    
    return statusPriority[a.status] - statusPriority[b.status];
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          File Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {sortedFiles.map((file) => {
              const progress = fileProgress[file.id];
              const isActive = file.status === 'uploading' || file.status === 'processing';
              
              return (
                <div
                  key={file.id}
                  className={cn(
                    'p-3 rounded-lg border transition-colors',
                    isActive && 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20',
                    file.status === 'error' && 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20',
                    file.status === 'completed' && 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {getStatusIcon(file.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={file.file.name}>
                          {file.file.name}
                        </p>
                        {file.error && (
                          <p className="text-xs text-red-600 mt-1">{file.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {getStatusBadge(file.status)}
                      {progress?.startTime && (
                        <span className="text-xs text-muted-foreground">
                          {getElapsedTime(progress.startTime, progress.endTime)}
                        </span>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {file.status === 'uploading' ? 'Uploading' : 'Processing'}
                        </span>
                        <span>{file.progress}%</span>
                      </div>
                      <Progress value={file.progress} className="h-1.5" />
                    </div>
                  )}

                  {file.status === 'uploaded' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Ready for processing
                    </p>
                  )}

                  {file.status === 'completed' && (
                    <p className="text-xs text-green-600 mt-1">
                      Enhancement complete
                    </p>
                  )}
                </div>
              );
            })}

            {files.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No files to track</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}