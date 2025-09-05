'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Download, FileText, Package, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Loading } from '@/components/ui/loading';

interface DownloadOptionsProps {
  enhancementId: string
  documentName: string
  enhancedUrl: string
  originalUrl: string
  reportUrl?: string
}

export function DownloadOptions({
  enhancementId: _enhancementId,
  documentName,
  enhancedUrl,
  originalUrl,
  reportUrl,
}: DownloadOptionsProps) {
  const { toast } = useToast()
  const [downloading, setDownloading] = useState<string | null>(null)

  const downloadFile = async (url: string, filename: string, type: string) => {
    try {
      setDownloading(type)
      
      // Fetch the file
      const response = await fetch(url)
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      
      toast({
        title: 'Download Complete',
        description: `${filename} has been downloaded successfully.`,
        duration: 3000,
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: 'Download Failed',
        description: 'Unable to download the file. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setDownloading(null)
    }
  }

  const getEnhancedFilename = () => {
    const baseName = documentName.replace(/\.[^/.]+$/, '')
    const extension = documentName.split('.').pop()
    return `${baseName}_enhanced.${extension}`
  }

  const getOriginalFilename = () => {
    const baseName = documentName.replace(/\.[^/.]+$/, '')
    const extension = documentName.split('.').pop()
    return `${baseName}_original.${extension}`
  }

  const downloadAll = async () => {
    setDownloading('all')
    
    try {
      // Download enhanced version
      await downloadFile(enhancedUrl, getEnhancedFilename(), 'enhanced-internal')
      
      // Download original
      await downloadFile(originalUrl, getOriginalFilename(), 'original-internal')
      
      // Download report if available
      if (reportUrl) {
        await downloadFile(reportUrl, `${documentName}_report.pdf`, 'report-internal')
      }
      
      toast({
        title: 'All Downloads Complete',
        description: 'All files have been downloaded successfully.',
        duration: 3000,
      })
    } catch (error) {
      console.error('Batch download error:', error)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Download Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => downloadFile(enhancedUrl, getEnhancedFilename(), 'enhanced')}
          disabled={downloading !== null}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              <span>Enhanced Version</span>
            </div>
            {downloading === 'enhanced' && (
              <Loading size="xs" inline />
            )}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => downloadFile(originalUrl, getOriginalFilename(), 'original')}
          disabled={downloading !== null}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              <span>Original Version</span>
            </div>
            {downloading === 'original' && (
              <Loading size="xs" inline />
            )}
          </div>
        </DropdownMenuItem>
        
        {reportUrl && (
          <DropdownMenuItem
            onClick={() => downloadFile(reportUrl, `${documentName}_report.pdf`, 'report')}
            disabled={downloading !== null}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                <span>Enhancement Report</span>
              </div>
              {downloading === 'report' && (
                <Loading size="xs" inline />
              )}
            </div>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={downloadAll}
          disabled={downloading !== null}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <Package className="h-4 w-4 mr-2" />
              <span>Download All</span>
            </div>
            {downloading === 'all' && (
              <Loading size="xs" inline />
            )}
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            <span>High-resolution files</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <CheckCircle className="h-3 w-3" />
            <span>No watermarks</span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}