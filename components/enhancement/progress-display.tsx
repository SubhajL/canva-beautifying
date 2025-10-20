"use client"

import { useDocumentProgress } from "@/hooks/use-document-progress"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Icons } from "@/components/ui/icons"
import {
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  FileText,
  Palette,
} from "lucide-react"

interface ProgressDisplayProps {
  documentId: string
  onComplete?: (data: {
    improvements?: { before: number; after: number }
    processingTime?: number
  }) => void
}

export function ProgressDisplay({
  documentId,
  onComplete,
}: ProgressDisplayProps) {
  const {
    isConnected,
    connectionError,
    currentStage,
    overallProgress,
    stageProgress,
    message,
    queuePosition,
    estimatedWaitTime,
    analysisFindings,
    isCompleted,
    completedData,
    error,
    retry,
  } = useDocumentProgress(documentId)

  // Call onComplete when enhancement is done
  if (isCompleted && completedData && onComplete) {
    onComplete(completedData)
  }

  // Connection error state
  if (connectionError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="mb-2 text-lg font-semibold">Connection Error</h3>
          <p className="mb-4 text-muted-foreground">{connectionError}</p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="mb-2 text-lg font-semibold">Enhancement Failed</h3>
          <p className="mb-4 text-muted-foreground">{error.message}</p>
          {error.retryable && (
            <Button onClick={retry}>
              <Icons.refresh className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Completed state
  if (isCompleted && completedData) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h3 className="mb-2 text-lg font-semibold">Enhancement Complete!</h3>
          {completedData.improvements && (
            <div className="mb-4">
              <p className="mb-2 text-sm text-muted-foreground">
                Quality Score
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-bold text-red-500">
                  {completedData.improvements.before}
                </span>
                <Icons.arrowRight className="h-5 w-5" />
                <span className="text-2xl font-bold text-green-500">
                  {completedData.improvements.after}
                </span>
              </div>
            </div>
          )}
          {completedData.processingTime && (
            <p className="text-sm text-muted-foreground">
              Processed in {Math.round(completedData.processingTime / 1000)}s
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Progress stages
  const stages = [
    { id: "queued", label: "Queued", icon: Clock },
    { id: "analysis", label: "Analyzing", icon: FileText },
    { id: "enhancement", label: "Enhancing", icon: Palette },
    { id: "export", label: "Exporting", icon: Zap },
  ]

  const currentStageIndex = stages.findIndex((s) => s.id === currentStage)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Enhancement Progress</span>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connected" : "Connecting..."}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Queue position */}
        {queuePosition !== undefined && (
          <div className="rounded-lg bg-muted py-4 text-center">
            <p className="text-sm text-muted-foreground">Position in queue</p>
            <p className="text-2xl font-bold">{queuePosition}</p>
            {estimatedWaitTime && (
              <p className="mt-1 text-sm text-muted-foreground">
                Est. wait: {Math.ceil(estimatedWaitTime / 60)} min
              </p>
            )}
          </div>
        )}

        {/* Stage indicators */}
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => {
            const Icon = stage.icon
            const isActive = stage.id === currentStage
            const isComplete = currentStageIndex > index

            return (
              <div key={stage.id} className="flex flex-1 flex-col items-center">
                <div
                  className={cn(
                    "mb-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                    isComplete
                      ? "bg-green-500 text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs",
                    isActive ? "font-medium" : "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Progress bars */}
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {currentStage && currentStage !== "queued" && (
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>Current Stage</span>
                <span>{stageProgress}%</span>
              </div>
              <Progress value={stageProgress} className="h-1" />
            </div>
          )}
        </div>

        {/* Current message */}
        {message && (
          <p className="text-center text-sm text-muted-foreground">{message}</p>
        )}

        {/* Analysis findings */}
        {analysisFindings && (
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500">
                {analysisFindings.colorIssues || 0}
              </p>
              <p className="text-xs text-muted-foreground">Color Issues</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">
                {analysisFindings.layoutIssues || 0}
              </p>
              <p className="text-xs text-muted-foreground">Layout Issues</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-500">
                {analysisFindings.typographyIssues || 0}
              </p>
              <p className="text-xs text-muted-foreground">Typography Issues</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
