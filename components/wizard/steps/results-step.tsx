'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useWizardStore } from '@/lib/stores/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  Download,
  Eye,
  Share2,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  FileText,
  ExternalLink,
  Copy,
  Mail
} from 'lucide-react';
import { formatDuration } from '@/lib/utils/format';

export function ResultsStep() {
  const router = useRouter();
  const { data, reset } = useWizardStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const handleDownload = async () => {
    if (!data.enhancedUrl) return;

    setIsDownloading(true);
    try {
      const response = await fetch(data.enhancedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enhanced-${data.fileName}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Download started!');
    } catch (_error) {
      toast.error('Failed to download file');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!data.enhancedUrl) return;

    setIsSharing(true);
    try {
      await navigator.clipboard.writeText(data.enhancedUrl);
      toast.success('Link copied to clipboard!');
    } catch (_error) {
      toast.error('Failed to copy link');
    } finally {
      setIsSharing(false);
    }
  };

  const handleStartNew = () => {
    reset();
    router.push('/enhance');
  };

  const handleViewDocument = () => {
    if (data.enhancedUrl) {
      window.open(data.enhancedUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Enhancement Complete!</h2>
          <p className="text-muted-foreground">
            Your document has been successfully enhanced
          </p>
        </div>
      </div>

      {/* Preview Card */}
      {data.thumbnailUrl && (
        <Card className="overflow-hidden">
          <div className="aspect-[4/3] relative bg-muted">
            <Image
              src={data.thumbnailUrl}
              alt="Enhanced document preview"
              fill
              className="object-contain"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        </Card>
      )}

      {/* Enhancement Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Enhancement Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{data.fileName}</span>
            </div>
            {data.processingTime && (
              <Badge variant="secondary">
                Processed in {formatDuration(data.processingTime)}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Improvements */}
          {data.improvements && data.improvements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Improvements Applied:</h4>
              <ul className="space-y-1">
                {data.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full"
          >
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download'}
          </Button>
          <Button
            onClick={handleViewDocument}
            variant="outline"
            className="w-full"
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleShare}
            variant="outline"
            disabled={isSharing}
            className="w-full"
          >
            {isSharing ? (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="mr-2 h-4 w-4" />
                Share Link
              </>
            )}
          </Button>
          <Button
            onClick={() => router.push('/dashboard')}
            variant="outline"
            className="w-full"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View All
          </Button>
        </div>

        <Separator />

        <Button
          onClick={handleStartNew}
          variant="default"
          className="w-full"
          size="lg"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Enhance Another Document
        </Button>
      </div>

      {/* Email Notification */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Check your email</p>
              <p className="text-sm text-muted-foreground">
                We&apos;ve sent a copy of your enhanced document to your email address
                along with a download link that&apos;s valid for 7 days.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}