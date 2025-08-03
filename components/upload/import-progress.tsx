'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Download,
  Upload as UploadIcon,
  FileCheck
} from 'lucide-react';

export interface ImportStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress?: number;
  error?: string;
}

interface ImportProgressProps {
  steps: ImportStep[];
  currentStep: number;
  onCancel?: () => void;
}

export function ImportProgress({ steps, currentStep, onCancel }: ImportProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  // Calculate overall progress
  const overallProgress = (currentStep / steps.length) * 100;
  
  useEffect(() => {
    // Animate progress bar
    const timer = setTimeout(() => {
      setAnimatedProgress(overallProgress);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [overallProgress]);

  const getStepIcon = (step: ImportStep, _index: number) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'active':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      default:
        // Custom icons based on step
        if (step.id === 'validate') {
          return <FileCheck className="h-5 w-5 text-muted-foreground" />;
        } else if (step.id === 'download') {
          return <Download className="h-5 w-5 text-muted-foreground" />;
        } else if (step.id === 'upload') {
          return <UploadIcon className="h-5 w-5 text-muted-foreground" />;
        }
        return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Import Progress</span>
              <span className="font-medium">{Math.round(animatedProgress)}%</span>
            </div>
            <Progress value={animatedProgress} className="h-2" />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-start gap-3 ${
                  step.status === 'pending' ? 'opacity-50' : ''
                }`}
              >
                {getStepIcon(step, index)}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm ${
                      step.status === 'active' ? 'font-medium' : ''
                    }`}>
                      {step.label}
                    </p>
                    {step.progress !== undefined && step.status === 'active' && (
                      <span className="text-xs text-muted-foreground">
                        {step.progress}%
                      </span>
                    )}
                  </div>
                  {step.error && (
                    <p className="text-xs text-red-500">{step.error}</p>
                  )}
                  {step.status === 'active' && step.progress !== undefined && (
                    <Progress value={step.progress} className="h-1" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Cancel button */}
          {onCancel && currentStep < steps.length && !steps.some(s => s.status === 'error') && (
            <div className="pt-2">
              <button
                onClick={onCancel}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel import
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper hook for managing import progress
export function useImportProgress() {
  const [steps, setSteps] = useState<ImportStep[]>([
    { id: 'validate', label: 'Validating Canva URL', status: 'pending' },
    { id: 'download', label: 'Downloading from Canva', status: 'pending' },
    { id: 'upload', label: 'Uploading to BeautifyAI', status: 'pending' },
    { id: 'process', label: 'Processing document', status: 'pending' },
  ]);
  
  const [currentStep, setCurrentStep] = useState(0);

  const updateStep = (stepId: string, updates: Partial<ImportStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, steps.length));
    
    // Update step statuses
    setSteps(prev => prev.map((step, index) => {
      if (index < currentStep) {
        return { ...step, status: 'completed' };
      } else if (index === currentStep) {
        return { ...step, status: 'active' };
      }
      return step;
    }));
  };

  const setError = (stepId: string, error: string) => {
    updateStep(stepId, { status: 'error', error });
  };

  const reset = () => {
    setCurrentStep(0);
    setSteps(prev => prev.map(step => ({ 
      ...step, 
      status: 'pending', 
      progress: undefined, 
      error: undefined 
    })));
  };

  return {
    steps,
    currentStep,
    updateStep,
    nextStep,
    setError,
    reset,
  };
}