'use client';

import React, { useRef } from 'react';
import { Upload, Camera, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileButton } from '@/components/ui/mobile-button';
import { cn } from '@/lib/utils';
import { useIsTouchDevice } from '@/lib/utils/responsive';
import { toast } from 'sonner';

interface MobileFileUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  disabled?: boolean;
  className?: string;
}

export function MobileFileUpload({
  onFilesSelected,
  accept = 'image/*,application/pdf',
  multiple = true,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
  className,
}: MobileFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isTouchDevice = useIsTouchDevice();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;

    // Validate file count
    if (files.length > maxFiles) {
      toast.error(`You can only upload up to ${maxFiles} files at once`);
      return;
    }

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      toast.error(`Some files are too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
      return;
    }

    onFilesSelected(files);
    
    // Reset input
    if (event.target) {
      event.target.value = '';
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const openCamera = () => {
    cameraInputRef.current?.click();
  };

  const ButtonComponent = isTouchDevice ? MobileButton : Button;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Mobile-optimized upload interface */}
      <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-6 text-center">
        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center space-y-4">
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Upload your documents</h3>
            <p className="text-sm text-muted-foreground">
              Choose files from your device or take a photo
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <ButtonComponent
              onClick={openFileDialog}
              disabled={disabled}
              size={isTouchDevice ? 'lg' : 'default'}
              className="w-full sm:w-auto"
            >
              <FileText className="mr-2 h-4 w-4" />
              Choose Files
            </ButtonComponent>

            {isTouchDevice && (
              <ButtonComponent
                onClick={openCamera}
                disabled={disabled}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </ButtonComponent>
            )}
          </div>

          {/* File type indicators */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              <span>PNG, JPG</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>PDF</span>
            </div>
          </div>

          {/* Limits info */}
          <p className="text-xs text-muted-foreground">
            Max {maxFiles} files • Up to {maxSize / 1024 / 1024}MB each
          </p>
        </div>
      </div>

      {/* Alternative: Compact button for space-constrained layouts */}
      {isTouchDevice && (
        <div className="relative">
          <ButtonComponent
            onClick={openFileDialog}
            disabled={disabled}
            variant="outline"
            size="lg"
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Tap to upload files
          </ButtonComponent>
        </div>
      )}
    </div>
  );
}

// Simplified upload button for mobile toolbars
export function MobileUploadButton({
  onFilesSelected,
  accept = 'image/*,application/pdf',
  multiple = true,
  disabled = false,
  variant = 'default' as any,
  size = 'default' as any,
  className,
  children,
}: MobileFileUploadProps & {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children?: React.ReactNode;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTouchDevice = useIsTouchDevice();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
      event.target.value = '';
    }
  };

  const ButtonComponent = isTouchDevice ? MobileButton : Button;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      
      <ButtonComponent
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        variant={variant}
        size={size}
        className={className}
      >
        {children || (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </>
        )}
      </ButtonComponent>
    </>
  );
}