import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface DownloadFile {
  id: string;
  fileName: string;
  url: string;
  type: 'original' | 'enhanced';
}

/**
 * Downloads multiple files as a ZIP archive
 */
export async function downloadBatch(
  files: DownloadFile[], 
  zipFileName: string = 'batch-download.zip',
  onProgress?: (progress: number, fileName: string) => void
) {
  const zip = new JSZip();
  const errors: Array<{ fileName: string; error: string }> = [];
  
  let completed = 0;
  const total = files.length;

  // Create folders for organization
  const originalFolder = zip.folder('original');
  const enhancedFolder = zip.folder('enhanced');

  // Download and add each file to the zip
  await Promise.all(
    files.map(async (file) => {
      try {
        onProgress?.(Math.round((completed / total) * 100), file.fileName);
        
        // Fetch the file
        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error(`Failed to download: ${response.statusText}`);
        }

        const blob = await response.blob();
        
        // Add to appropriate folder
        const folder = file.type === 'original' ? originalFolder : enhancedFolder;
        folder?.file(file.fileName, blob);
        
        completed++;
        onProgress?.(Math.round((completed / total) * 100), file.fileName);
      } catch (error) {
        console.error(`Error downloading ${file.fileName}:`, error);
        errors.push({
          fileName: file.fileName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        completed++;
      }
    })
  );

  // Add error report if there were any errors
  if (errors.length > 0) {
    const errorReport = errors
      .map(e => `${e.fileName}: ${e.error}`)
      .join('\n');
    zip.file('download-errors.txt', errorReport);
  }

  // Generate and download the zip
  try {
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    
    saveAs(content, zipFileName);
    
    return {
      success: true,
      totalFiles: total,
      downloadedFiles: total - errors.length,
      errors,
    };
  } catch (error) {
    console.error('Error generating ZIP:', error);
    throw new Error('Failed to generate download archive');
  }
}

/**
 * Downloads a single file
 */
export function downloadSingleFile(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generates a batch report as a CSV file
 */
export function generateBatchReport(
  files: Array<{
    id: string;
    fileName: string;
    status: string;
    processingTime?: number;
    error?: string;
    enhancementDetails?: Record<string, any>;
  }>,
  reportName: string = 'batch-report.csv'
) {
  // Create CSV header
  const headers = [
    'File Name',
    'Status',
    'Processing Time (seconds)',
    'Error',
    'Enhancements Applied',
  ];

  // Create CSV rows
  const rows = files.map(file => {
    const enhancements = file.enhancementDetails
      ? Object.entries(file.enhancementDetails)
          .map(([key, value]) => `${key}: ${value}`)
          .join('; ')
      : '';

    return [
      file.fileName,
      file.status,
      file.processingTime ? file.processingTime.toFixed(2) : '',
      file.error || '',
      enhancements,
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  // Create and download the CSV file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, reportName);
}

/**
 * Batch download with retry logic for failed downloads
 */
export async function downloadBatchWithRetry(
  files: DownloadFile[],
  zipFileName: string = 'batch-download.zip',
  maxRetries: number = 3,
  onProgress?: (progress: number, fileName: string) => void
) {
  const failedFiles: DownloadFile[] = [];
  let attempt = 0;
  
  while (attempt < maxRetries && files.length > 0) {
    const result = await downloadBatch(
      attempt === 0 ? files : failedFiles,
      zipFileName,
      onProgress
    );
    
    if (result.errors.length === 0) {
      return result;
    }
    
    // Prepare for retry with failed files
    failedFiles.length = 0;
    result.errors.forEach(error => {
      const failedFile = files.find(f => f.fileName === error.fileName);
      if (failedFile) {
        failedFiles.push(failedFile);
      }
    });
    
    attempt++;
    
    if (failedFiles.length > 0 && attempt < maxRetries) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return {
    success: failedFiles.length === 0,
    totalFiles: files.length,
    downloadedFiles: files.length - failedFiles.length,
    errors: failedFiles.map(f => ({
      fileName: f.fileName,
      error: 'Failed after maximum retries',
    })),
  };
}