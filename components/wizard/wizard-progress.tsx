'use client';

import { useWizardStore, WizardStep } from '@/lib/stores/wizard-store';
import { cn } from '@/lib/utils';
import { Check, Upload, Users, Palette, FileCheck, Loader2, Sparkles } from 'lucide-react';

const steps: Array<{
  id: WizardStep;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'upload', label: 'Upload', icon: Upload },
  { id: 'audience', label: 'Audience', icon: Users },
  { id: 'style', label: 'Style', icon: Palette },
  { id: 'review', label: 'Review', icon: FileCheck },
  { id: 'processing', label: 'Processing', icon: Loader2 },
  { id: 'results', label: 'Results', icon: Sparkles },
];

export function WizardProgress() {
  const { currentStep, isStepCompleted } = useWizardStore();

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="relative">
      {/* Progress line */}
      <div className="absolute left-0 top-5 h-0.5 w-full bg-muted">
        <div
          className="absolute h-full bg-primary transition-all duration-300"
          style={{
            width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
          }}
        />
      </div>

      {/* Steps */}
      <ol className="relative flex justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = isStepCompleted(step.id);
          const isCurrent = step.id === currentStep;
          const isPast = index < currentStepIndex;

          return (
            <li key={step.id} className="flex flex-col items-center">
              <div
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background transition-all",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && !isCompleted && "border-primary",
                  !isCompleted && !isCurrent && "border-muted-foreground/30"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className={cn(
                    "h-5 w-5",
                    isCurrent && "text-primary",
                    step.id === 'processing' && isCurrent && "animate-spin"
                  )} />
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium",
                  isCurrent && "text-primary",
                  !isCurrent && !isPast && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}