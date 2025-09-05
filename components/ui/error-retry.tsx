'use client';

import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface ErrorRetryProps {
  error: string | Error;
  onRetry?: () => void;
  className?: string;
  variant?: 'default' | 'destructive';
  showIcon?: boolean;
  retryText?: string;
}

export function ErrorRetry({
  error,
  onRetry,
  className,
  variant = 'destructive',
  showIcon = true,
  retryText = 'Retry'
}: ErrorRetryProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  // Clean up error messages - remove technical details
  const cleanedMessage = errorMessage
    .replace(/TypeError:|Error:|at\s+.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <Alert variant={variant} className={cn('relative', className)}>
      {showIcon && <AlertCircle className="h-4 w-4" />}
      <AlertDescription className="pr-20">
        {cleanedMessage}
      </AlertDescription>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="absolute right-4 top-4"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          {retryText}
        </Button>
      )}
    </Alert>
  );
}

export interface NetworkStatusProps {
  isOnline: boolean;
  onRetry?: () => void;
  className?: string;
}

export function NetworkStatus({
  isOnline,
  onRetry,
  className
}: NetworkStatusProps) {
  if (isOnline) {
    return null;
  }

  return (
    <Alert variant="destructive" className={cn('relative', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="pr-20">
        You appear to be offline. Please check your internet connection.
      </AlertDescription>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="absolute right-4 top-4"
          disabled={!isOnline}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </Alert>
  );
}