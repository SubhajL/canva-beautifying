import * as React from "react"
import { cn } from "@/lib/utils"

interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  variant?: "default" | "outline" | "ghost"
  size?: "sm" | "default" | "lg"
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, orientation = "horizontal", variant = "default", size = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex",
          orientation === "horizontal" ? "flex-row" : "flex-col",
          variant === "outline" && "[&>*]:border-l-0 [&>*:first-child]:border-l",
          className
        )}
        {...props}
      >
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return child
          
          const isFirst = index === 0
          const isLast = index === React.Children.count(children) - 1
          
          return React.cloneElement(child as React.ReactElement<any>, {
            size,
            variant,
            className: cn(
              child.props.className,
              orientation === "horizontal" ? (
                isFirst && !isLast ? "rounded-r-none" :
                !isFirst && isLast ? "rounded-l-none" :
                !isFirst && !isLast ? "rounded-none" : ""
              ) : (
                isFirst && !isLast ? "rounded-b-none" :
                !isFirst && isLast ? "rounded-t-none" :
                !isFirst && !isLast ? "rounded-none" : ""
              ),
              variant === "outline" && orientation === "horizontal" && !isFirst && "border-l-0",
              variant === "outline" && orientation === "vertical" && !isFirst && "border-t-0"
            ),
          })
        })}
      </div>
    )
  }
)
ButtonGroup.displayName = "ButtonGroup"

export { ButtonGroup }