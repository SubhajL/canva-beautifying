'use client';

import { useWizardStore } from '@/lib/stores/wizard-store';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function WizardNavigation() {
  const { 
    currentStep, 
    nextStep, 
    previousStep, 
    validateCurrentStep,
    errors 
  } = useWizardStore();

  const canGoBack = currentStep !== 'upload';
  const canGoForward = currentStep !== 'review';

  const handleNext = () => {
    if (validateCurrentStep()) {
      nextStep();
    }
  };

  const currentError = errors[currentStep];

  return (
    <div className="space-y-3">
      {currentError && (
        <div className="text-center">
          <p className="text-sm text-destructive">{currentError}</p>
        </div>
      )}
      
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={previousStep}
          disabled={!canGoBack}
          className="flex-1 sm:flex-none sm:min-w-[120px]"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
          <span className="sm:hidden">Back</span>
        </Button>

        <Button
          onClick={handleNext}
          disabled={!canGoForward}
          className="flex-1 sm:flex-none sm:min-w-[120px]"
        >
          {currentStep === 'review' ? (
            <>
              <span className="hidden sm:inline">Start Enhancement</span>
              <span className="sm:hidden">Start</span>
            </>
          ) : 'Next'}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}