import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  change?: {
    value: number
    type: "increase" | "decrease" | "neutral"
  }
  icon?: LucideIcon
  prefix?: string
  suffix?: string
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ 
    className, 
    label, 
    value,
    change,
    icon: Icon,
    prefix,
    suffix,
    ...props 
  }, ref) => {
    const getTrendIcon = () => {
      if (!change) return null
      
      switch (change.type) {
        case "increase":
          return TrendingUp
        case "decrease":
          return TrendingDown
        default:
          return Minus
      }
    }
    
    const getTrendColor = () => {
      if (!change) return ""
      
      switch (change.type) {
        case "increase":
          return "text-success"
        case "decrease":
          return "text-error"
        default:
          return "text-muted-foreground"
      }
    }
    
    const TrendIcon = getTrendIcon()
    
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card p-6 transition-all hover:shadow-md",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">
              {prefix}
              {value}
              {suffix}
            </p>
            {change && (
              <div className={cn("flex items-center gap-1 text-sm", getTrendColor())}>
                {TrendIcon && <TrendIcon className="h-4 w-4" />}
                <span>{Math.abs(change.value)}%</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="rounded-lg bg-primary/10 p-3">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          )}
        </div>
      </div>
    )
  }
)
MetricCard.displayName = "MetricCard"

export { MetricCard }