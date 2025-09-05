'use client';

import { StatusMessage } from '@/components/a11y/live-region';
import { useEffect, useState } from 'react';

interface UploadAnnouncementsProps {
  fileCount?: number;
  isProcessing?: boolean;
  error?: string;
}

export function UploadAnnouncements({ 
  fileCount = 0, 
  isProcessing = false,
  error 
}: UploadAnnouncementsProps) {
  const [message, setMessage] = useState<string>('');
  
  useEffect(() => {
    if (error) {
      setMessage(`Error: ${error}`);
    } else if (isProcessing) {
      setMessage(`Processing ${fileCount} file${fileCount !== 1 ? 's' : ''}...`);
    } else if (fileCount > 0) {
      setMessage(`${fileCount} file${fileCount !== 1 ? 's' : ''} ready for upload`);
    } else {
      setMessage('Ready to accept files');
    }
  }, [fileCount, isProcessing, error]);
  
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      <StatusMessage 
        message={message} 
        type={error ? 'error' : isProcessing ? 'info' : 'success'}
        role="status"
      />
    </div>
  );
}