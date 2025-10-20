"use client"

import { useWizardStore } from "@/lib/stores/wizard-store"
import { WizardProgress } from "./wizard-progress"
import { WizardProgressMobile } from "./wizard-progress-mobile"
import { WizardNavigation } from "./wizard-navigation"
import { UploadStep } from "./steps/upload-step"
import { ModelStep } from "./steps/model-step"
import { AudienceStep } from "./steps/audience-step"
import { StyleStep } from "./steps/style-step"
import { ReviewStep } from "./steps/review-step"
import { ProcessingStep } from "./steps/processing-step"
import { ResultsStep } from "./steps/results-step"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useBreakpoint } from "@/lib/utils/responsive"

export function EnhancementWizard() {
  const { currentStep } = useWizardStore()
  const { isMobile } = useBreakpoint()

  const renderStep = () => {
    switch (currentStep) {
      case "upload":
        return <UploadStep />
      case "model":
        return <ModelStep />
      case "audience":
        return <AudienceStep />
      case "style":
        return <StyleStep />
      case "review":
        return <ReviewStep />
      case "processing":
        return <ProcessingStep />
      case "results":
        return <ResultsStep />
      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 md:space-y-6 md:px-6 md:py-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold md:text-3xl">
          Document Enhancement Wizard
        </h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Transform your documents with AI-powered enhancements
        </p>
      </div>

      {isMobile ? <WizardProgressMobile /> : <WizardProgress />}

      <Card
        className={cn(
          "p-4 md:p-6",
          currentStep === "processing" && "min-h-[300px] md:min-h-[400px]",
          currentStep === "results" && "min-h-[400px] md:min-h-[500px]"
        )}
      >
        <div className="space-y-4 md:space-y-6">{renderStep()}</div>
      </Card>

      {currentStep !== "processing" && currentStep !== "results" && (
        <WizardNavigation />
      )}
    </div>
  )
}
