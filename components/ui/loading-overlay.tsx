import * as React from "react"
import { cn } from "@/lib/utils"
import { Spinner } from "./spinner"

interface LoadingOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  visible: boolean
  message?: string
  spinnerSize?: "sm" | "default" | "lg" | "xl"
  fullScreen?: boolean
}

const LoadingOverlay = React.forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({ className, visible, message, spinnerSize = "lg", fullScreen = false, ...props }, ref) => {
    if (!visible) return null
    
    return (
      <div
        ref={ref}
        className={cn(
          "absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
          fullScreen && "fixed",
          className
        )}
        {...props}
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner size={spinnerSize} />
          {message && (
            <p className="text-sm font-medium text-muted-foreground">{message}</p>
          )}
        </div>
      </div>
    )
  }
)
LoadingOverlay.displayName = "LoadingOverlay"

export { LoadingOverlay }