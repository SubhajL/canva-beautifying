'use client';

import { useWizardStore, WizardStep } from '@/lib/stores/wizard-store';

export function WizardProgressMobile() {
  const { currentStep } = useWizardStore();

  const steps: WizardStep[] = ['upload', 'audience', 'style', 'review', 'processing', 'results'];
  const currentIndex = steps.indexOf(currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          Step {currentIndex + 1} of {steps.length}
        </span>
        <span className="text-sm text-muted-foreground capitalize">
          {currentStep}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}