import * as React from "react"
import { cn } from "@/lib/utils"

interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  children: React.ReactNode
}

const Chart = React.forwardRef<HTMLDivElement, ChartProps>(
  ({ className, title, description, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("w-full rounded-lg border bg-card p-6", className)}
        {...props}
      >
        {(title || description) && (
          <div className="mb-4">
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}
        <div className="w-full">{children}</div>
      </div>
    )
  }
)
Chart.displayName = "Chart"

export { Chart }