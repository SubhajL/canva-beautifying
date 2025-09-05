'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/auth';
import { formatFileSize } from '@/lib/utils/format';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Download,
  RefreshCw,
  ArrowLeft,
  Files
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface BatchDocument {
  documentId: string;
  status: string;
  enhancedUrl?: string;
  metadata?: any;
}

interface BatchStatus {
  batchId: string;
  status: string;
  totalDocuments: number;
  completed: number;
  failed: number;
  processing: number;
  documents: BatchDocument[];
  createdAt: string;
  updatedAt: string;
}

export default function BatchResultsPage() {
  const router = useRouter();
  const { batchId } = useParams();
  const { session } = useAuth();
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBatchStatus = async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/v1/enhance/batch?batchId=${batchId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch batch status');
      }

      const data = await response.json();
      setBatchStatus(data);
    } catch (error) {
      console.error('Error fetching batch status:', error);
      toast.error('Failed to load batch status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBatchStatus();

    // Poll for updates while processing
    const interval = setInterval(() => {
      if (batchStatus && batchStatus.status === 'processing') {
        fetchBatchStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [batchId, session]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBatchStatus();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
      case 'processing':
      case 'analyzing':
        return <Badge variant="default">Processing</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!batchStatus) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Batch Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested batch could not be found.</p>
            <Button onClick={() => router.push('/dashboard')}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = (batchStatus.completed / batchStatus.totalDocuments) * 100;
  const isComplete = batchStatus.status !== 'processing';

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Files className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Batch Enhancement Results</h1>
              <p className="text-sm text-muted-foreground">Batch ID: {batchId}</p>
            </div>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Enhancement Progress</span>
            {getStatusBadge(batchStatus.status)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-4" />
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{batchStatus.completed}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{batchStatus.processing}</p>
              <p className="text-sm text-muted-foreground">Processing</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{batchStatus.failed}</p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {batchStatus.documents.map((doc, index) => (
              <div
                key={doc.documentId}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(doc.status)}
                  <div>
                    <p className="font-medium">Document {index + 1}</p>
                    <p className="text-sm text-muted-foreground">ID: {doc.documentId}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusBadge(doc.status)}
                  
                  {doc.status === 'completed' && doc.enhancedUrl && (
                    <Button
                      size="sm"
                      onClick={() => router.push(`/results/${doc.documentId}`)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      View Result
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {isComplete && (
        <div className="mt-6 flex justify-center gap-4">
          <Button
            onClick={() => router.push('/enhance/wizard')}
          >
            Enhance More Documents
          </Button>
          
          {batchStatus.completed > 0 && (
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download All Results
            </Button>
          )}
        </div>
      )}
    </div>
  );
}