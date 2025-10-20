"use client"

import { useWizardStore, WizardStep } from "@/lib/stores/wizard-store"

export function WizardProgressMobile() {
  const { currentStep } = useWizardStore()

  const steps: WizardStep[] = [
    "upload",
    "audience",
    "style",
    "review",
    "processing",
    "results",
  ]
  const currentIndex = steps.indexOf(currentStep)
  const progress = ((currentIndex + 1) / steps.length) * 100

  return (
    <div className="lg:hidden">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">
          Step {currentIndex + 1} of {steps.length}
        </span>
        <span className="text-sm capitalize text-muted-foreground">
          {currentStep}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
