import * as React from "react"
import { cn } from "@/lib/utils"

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column"
  align?: "start" | "center" | "end" | "stretch"
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly"
  gap?: "none" | "sm" | "default" | "lg" | "xl"
  wrap?: boolean
}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ 
    className, 
    direction = "column", 
    align = "stretch",
    justify = "start",
    gap = "default",
    wrap = false,
    ...props 
  }, ref) => {
    const directionClasses = {
      row: "flex-row",
      column: "flex-col",
    }
    
    const alignClasses = {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    }
    
    const justifyClasses = {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    }
    
    const gapClasses = {
      none: "gap-0",
      sm: "gap-2",
      default: "gap-4",
      lg: "gap-6",
      xl: "gap-8",
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          directionClasses[direction],
          alignClasses[align],
          justifyClasses[justify],
          gapClasses[gap],
          wrap && "flex-wrap",
          className
        )}
        {...props}
      />
    )
  }
)
Stack.displayName = "Stack"

export { Stack }