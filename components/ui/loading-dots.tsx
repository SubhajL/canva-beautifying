import * as React from "react"
import { cn } from "@/lib/utils"

interface LoadingDotsProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg"
  color?: "default" | "primary" | "secondary" | "muted"
}

const LoadingDots = React.forwardRef<HTMLDivElement, LoadingDotsProps>(
  ({ className, size = "default", color = "default", ...props }, ref) => {
    const sizeClasses = {
      sm: "space-x-1",
      default: "space-x-2",
      lg: "space-x-3",
    }
    
    const dotSizeClasses = {
      sm: "h-1.5 w-1.5",
      default: "h-2 w-2",
      lg: "h-3 w-3",
    }
    
    const colorClasses = {
      default: "bg-foreground",
      primary: "bg-primary",
      secondary: "bg-secondary",
      muted: "bg-muted-foreground",
    }
    
    return (
      <div
        ref={ref}
        className={cn("flex items-center", sizeClasses[size], className)}
        {...props}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "animate-pulse rounded-full",
              dotSizeClasses[size],
              colorClasses[color]
            )}
            style={{
              animationDelay: `${i * 0.15}s`,
              animationDuration: "1.4s",
            }}
          />
        ))}
      </div>
    )
  }
)
LoadingDots.displayName = "LoadingDots"

export { LoadingDots }