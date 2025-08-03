import * as React from "react"
import { Progress } from "./progress"
import { cn } from "@/lib/utils"

interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  label?: string
  showPercentage?: boolean
  size?: "sm" | "default" | "lg"
  variant?: "default" | "success" | "warning" | "error"
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ 
    className, 
    value, 
    max = 100, 
    label, 
    showPercentage = true, 
    size = "default",
    variant = "default",
    ...props 
  }, ref) => {
    const percentage = Math.round((value / max) * 100)
    
    const sizeClasses = {
      sm: "h-2",
      default: "h-4",
      lg: "h-6",
    }
    
    const variantClasses = {
      default: "",
      success: "[&>div]:bg-gradient-to-r [&>div]:from-success [&>div]:to-success/80",
      warning: "[&>div]:bg-gradient-to-r [&>div]:from-warning [&>div]:to-warning/80",
      error: "[&>div]:bg-gradient-to-r [&>div]:from-error [&>div]:to-error/80",
    }
    
    return (
      <div ref={ref} className={cn("w-full space-y-2", className)} {...props}>
        {(label || showPercentage) && (
          <div className="flex items-center justify-between text-sm">
            {label && <span className="font-medium">{label}</span>}
            {showPercentage && (
              <span className="text-muted-foreground">{percentage}%</span>
            )}
          </div>
        )}
        <Progress 
          value={percentage} 
          className={cn(
            sizeClasses[size],
            variantClasses[variant]
          )}
        />
      </div>
    )
  }
)
ProgressBar.displayName = "ProgressBar"

export { ProgressBar }