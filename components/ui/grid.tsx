import * as React from "react"
import { cn } from "@/lib/utils"

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  gap?: "none" | "sm" | "default" | "lg" | "xl"
}

const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols = { default: 1 }, gap = "default", ...props }, ref) => {
    const gapClasses = {
      none: "gap-0",
      sm: "gap-2",
      default: "gap-4",
      lg: "gap-6",
      xl: "gap-8",
    }
    
    const getGridCols = () => {
      const classes = []
      
      if (cols.default) classes.push(`grid-cols-${cols.default}`)
      if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`)
      if (cols.md) classes.push(`md:grid-cols-${cols.md}`)
      if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`)
      if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`)
      
      return classes.join(" ")
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          "grid",
          getGridCols(),
          gapClasses[gap],
          className
        )}
        {...props}
      />
    )
  }
)
Grid.displayName = "Grid"

export { Grid }