'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/lib/stores/wizard-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/auth';
import { useApiError } from '@/hooks/use-error-handler';
import { toast } from 'sonner';
import { 
  FileText, 
  Users, 
  Palette, 
  Check,
  Loader2,
  Edit,
  Sparkles,
  Cpu,
  Files,
  X,
  AlertCircle
} from 'lucide-react';
import { formatFileSize } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

const getAudienceLabel = (value: string | null) => {
  const audiences: Record<string, string> = {
    students: 'Students',
    teachers: 'Teachers',
    parents: 'Parents',
    professionals: 'Professionals',
  };
  return audiences[value || ''] || value;
};

const getGradeLabel = (value: string | null) => {
  const grades: Record<string, string> = {
    'prek': 'Pre-K',
    'k-2': 'Kindergarten - 2nd Grade',
    '3-5': '3rd - 5th Grade',
    '6-8': '6th - 8th Grade',
    '9-12': '9th - 12th Grade',
    'college': 'College/University',
    'adult': 'Adult Education',
    'professional': 'Professional Development',
  };
  return grades[value || ''] || value;
};

const getStyleLabel = (value: string | null) => {
  const styles: Record<string, string> = {
    modern: 'Modern & Clean',
    vibrant: 'Vibrant & Engaging',
    professional: 'Professional',
    playful: 'Playful & Fun',
  };
  return styles[value || ''] || value;
};

const getModelLabel = (value: string | null) => {
  const models: Record<string, string> = {
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gpt-4o-mini': 'GPT-4o Mini',
    'claude-3.5-sonnet': 'Claude 3.5 Sonnet',
    'ensemble': 'Ensemble Mode',
  };
  return models[value || ''] || value;
};

export function ReviewStep() {
  const router = useRouter();
  const { user, session } = useAuth();
  const { data, setStep, updateData, setProcessing, removeFile } = useWizardStore();
  const { handleApiError } = useApiError();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uploadedFiles = data.files?.filter(f => f.status === 'uploaded') || [];
  const hasMultipleFiles = uploadedFiles.length > 1;

  const handleStartEnhancement = async () => {
    if (!user || !session || uploadedFiles.length === 0) return;

    setIsSubmitting(true);
    setProcessing(true);

    try {
      const preferences = {
        selectedModel: data.selectedModel,
        targetAudience: data.targetAudience,
        gradeLevel: data.gradeLevel,
        subject: data.subject,
        purpose: data.purpose,
        enhancementStyle: data.enhancementStyle,
        colorScheme: data.colorScheme,
        visualComplexity: data.visualComplexity,
        includeGraphics: data.includeGraphics,
        includeCharts: data.includeCharts,
      };

      if (hasMultipleFiles) {
        // Use batch API for multiple files
        const documentIds = uploadedFiles.map(f => f.documentId).filter(Boolean) as string[];
        
        const response = await fetch('/api/v1/enhance/batch', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentIds,
            preferences,
          }),
        });

        if (!response.ok) {
          await handleApiError(response);
          setProcessing(false);
          return;
        }

        const result = await response.json();

        // Update wizard data with batch info
        updateData({
          batchId: result.batchId,
          batchResults: result.results,
        });

        // Navigate to batch results page
        router.push(`/enhance/batch/${result.batchId}`);
        
        toast.success('Batch enhancement started!', {
          description: `Processing ${result.queued} documents.`,
        });

      } else {
        // Single file enhancement
        const file = uploadedFiles[0];
        
        // Prepare form data
        const formData = new FormData();
        formData.append('file', file.file);
        formData.append('settings', JSON.stringify({ enhancementSettings: preferences }));

        // Submit enhancement request
        const response = await fetch('/api/v1/enhance', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          await handleApiError(response);
          setProcessing(false);
          return;
        }

        const result = await response.json();

        // Update wizard data with IDs
        updateData({
          enhancementId: result.data.id,
          documentId: result.data.documentId,
          jobId: result.data.jobId,
        });

        // Move to processing step
        setStep('processing');
        
        toast.success('Enhancement started!', {
          description: 'Your document is being processed.',
        });
      }

    } catch (error) {
      console.error('Enhancement error:', error);
      toast.error('Failed to start enhancement');
      setProcessing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Review Your Selections</h2>
        <p className="text-muted-foreground">
          Confirm your choices before we enhance your {hasMultipleFiles ? 'documents' : 'document'}
        </p>
      </div>

      <div className="space-y-4">
        {/* Documents Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {hasMultipleFiles ? (
                <>
                  <Files className="h-4 w-4" />
                  Documents ({uploadedFiles.length})
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Document
                </>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('upload')}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </CardHeader>
          <CardContent>
            {uploadedFiles.length > 0 ? (
              <div className="space-y-3">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.fileSize)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="flex-shrink-0 ml-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>No documents uploaded</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Model Selection */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              AI Model
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('model')}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Selected model:</span>
              <Badge variant="default">{getModelLabel(data.selectedModel)}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Audience Settings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Audience
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('audience')}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Target:</span>
                <Badge variant="secondary">{getAudienceLabel(data.targetAudience)}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Grade:</span>
                <Badge variant="secondary">{getGradeLabel(data.gradeLevel)}</Badge>
              </div>
              {data.subject && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Subject:</span>
                  <span className="text-sm capitalize">{data.subject}</span>
                </div>
              )}
              {data.purpose && (
                <div className="mt-3">
                  <span className="text-sm text-muted-foreground">Purpose:</span>
                  <p className="text-sm mt-1">{data.purpose}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Style Settings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Style
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('style')}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Style:</span>
                <Badge variant="secondary">{getStyleLabel(data.enhancementStyle)}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Colors:</span>
                <Badge variant="secondary" className="capitalize">{data.colorScheme}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Complexity:</span>
                <span className="text-sm capitalize">{data.visualComplexity}</span>
              </div>
              
              <Separator className="my-2" />
              
              <div className="space-y-1">
                {data.includeGraphics && (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-3 w-3 text-green-600" />
                    <span>Include graphics & icons</span>
                  </div>
                )}
                {data.includeCharts && (
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="h-3 w-3 text-green-600" />
                    <span>Generate charts & graphs</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={handleStartEnhancement}
          disabled={isSubmitting || uploadedFiles.length === 0}
          className="min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {hasMultipleFiles ? 'Start Batch Enhancement' : 'Start Enhancement'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}