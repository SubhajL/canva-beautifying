'use client';

import React from 'react';
import Image from 'next/image';
import { FileText, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { BatchFile } from '@/lib/stores/batch-upload-store';

interface BatchPreviewGridProps {
  files: BatchFile[];
  onRemove: (fileId: string) => void;
  onToggleSelect: (fileId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  readOnly?: boolean;
}

export function BatchPreviewGrid({
  files,
  onRemove,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  readOnly = false,
}: BatchPreviewGridProps) {
  const selectedCount = files.filter(f => f.selected).length;
  const allSelected = selectedCount === files.length && files.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < files.length;

  const getStatusIcon = (status: BatchFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: BatchFile['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'uploading':
        return 'Uploading...';
      case 'uploaded':
        return 'Uploaded';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return '';
    }
  };

  const getStatusColor = (status: BatchFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Selection controls */}
      {!readOnly && files.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Checkbox
              checked={allSelected || someSelected}
              onCheckedChange={(checked) => {
                if (checked && !allSelected) {
                  onSelectAll();
                } else {
                  onDeselectAll();
                }
              }}
              aria-label="Select all files"
            />
            <span className="text-sm text-muted-foreground">
              {selectedCount} of {files.length} selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectAll}
              disabled={allSelected}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeselectAll}
              disabled={selectedCount === 0}
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* File grid - responsive with larger touch targets on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {files.map((file) => {
          const isImage = file.file.type.startsWith('image/');
          const _isPDF = file.file.type === 'application/pdf';

          return (
            <div
              key={file.id}
              className={cn(
                'relative group rounded-lg border bg-card overflow-hidden transition-all',
                file.selected && !readOnly && 'ring-2 ring-primary',
                file.status === 'error' && 'border-red-500'
              )}
            >
              {/* Selection checkbox */}
              {!readOnly && (
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox
                    checked={file.selected}
                    onCheckedChange={() => onToggleSelect(file.id)}
                    className="bg-white/90 backdrop-blur-sm"
                    aria-label={`Select ${file.file.name}`}
                  />
                </div>
              )}

              {/* Remove button */}
              {!readOnly && file.status === 'pending' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm"
                  onClick={() => onRemove(file.id)}
                  aria-label={`Remove ${file.file.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {/* Preview */}
              <div className="aspect-square relative bg-muted">
                {isImage ? (
                  <Image
                    src={file.preview}
                    alt={file.file.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                {/* Progress overlay */}
                {(file.status === 'uploading' || file.status === 'processing') && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-3/4">
                      <Progress value={file.progress} className="h-2" />
                      <p className="text-white text-xs mt-1 text-center">
                        {file.progress}%
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="p-3 space-y-1">
                <p className="text-sm font-medium truncate" title={file.file.name}>
                  {file.file.name}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {(file.file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                  <div className={cn('flex items-center gap-1', getStatusColor(file.status))}>
                    {getStatusIcon(file.status)}
                    <span className="text-xs">{getStatusText(file.status)}</span>
                  </div>
                </div>
                {file.error && (
                  <p className="text-xs text-red-600 truncate" title={file.error}>
                    {file.error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {files.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No files uploaded yet</p>
        </div>
      )}
    </div>
  );
}