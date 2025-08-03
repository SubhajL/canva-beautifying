import * as React from "react"
import { cn } from "@/lib/utils"

interface BarData {
  label: string
  value: number
  color?: string
}

interface BarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: BarData[]
  height?: number
  showValues?: boolean
  orientation?: "vertical" | "horizontal"
}

const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>(
  ({ 
    className, 
    data, 
    height = 200, 
    showValues = true,
    orientation = "vertical",
    ...props 
  }, ref) => {
    const maxValue = Math.max(...data.map(d => d.value))
    
    if (orientation === "horizontal") {
      return (
        <div ref={ref} className={cn("space-y-3", className)} {...props}>
          {data.map((item, index) => {
            const percentage = (item.value / maxValue) * 100
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  {showValues && <span className="text-muted-foreground">{item.value}</span>}
                </div>
                <div className="h-6 w-full rounded-full bg-secondary/20">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      item.color ? "" : "bg-primary"
                    )}
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )
    }
    
    return (
      <div
        ref={ref}
        className={cn("relative", className)}
        style={{ height }}
        {...props}
      >
        <div className="absolute inset-0 flex items-end justify-between gap-2">
          {data.map((item, index) => {
            const percentage = (item.value / maxValue) * 100
            return (
              <div
                key={index}
                className="relative flex-1 flex flex-col items-center justify-end"
              >
                {showValues && (
                  <span className="mb-2 text-sm font-medium">
                    {item.value}
                  </span>
                )}
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-500 ease-out",
                    item.color ? "" : "bg-primary"
                  )}
                  style={{
                    height: `${percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
                <span className="mt-2 text-xs text-muted-foreground truncate max-w-full">
                  {item.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
BarChart.displayName = "BarChart"

export { BarChart, type BarData }