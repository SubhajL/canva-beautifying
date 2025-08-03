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
  Sparkles
} from 'lucide-react';
import { formatFileSize } from '@/lib/utils/format';

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

export function ReviewStep() {
  const _router = useRouter();
  const { user, session } = useAuth();
  const { data, setStep, updateData, setProcessing } = useWizardStore();
  const { handleApiError } = useApiError();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartEnhancement = async () => {
    if (!user || !session || !data.file) return;

    setIsSubmitting(true);
    setProcessing(true);

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('file', data.file);
      
      const settings = {
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
      
      formData.append('settings', JSON.stringify({ enhancementSettings: settings }));

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
          Confirm your choices before we enhance your document
        </p>
      </div>

      <div className="space-y-4">
        {/* Document Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Document
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
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">File name:</span>
                <span className="text-sm font-medium">{data.fileName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Size:</span>
                <span className="text-sm">{formatFileSize(data.fileSize || 0)}</span>
              </div>
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
          disabled={isSubmitting}
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
              Start Enhancement
            </>
          )}
        </Button>
      </div>
    </div>
  );
}