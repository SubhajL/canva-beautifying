import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { cn } from "@/lib/utils"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: "default" | "gradient"
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ 
    className, 
    title, 
    value,
    description,
    icon: Icon,
    trend,
    variant = "default",
    ...props 
  }, ref) => {
    return (
      <Card 
        ref={ref} 
        variant={variant}
        className={cn("", className)}
        {...props}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {Icon && (
            <Icon className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {(description || trend) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {trend && (
                <span className={cn(
                  "flex items-center gap-1",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}>
                  {trend.isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(trend.value)}%
                </span>
              )}
              {description && <span>{description}</span>}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }