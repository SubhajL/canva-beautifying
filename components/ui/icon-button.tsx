import * as React from "react"
import { Button, ButtonProps } from "./button"
import { cn } from "@/lib/utils"

export interface IconButtonProps extends Omit<ButtonProps, "size"> {
  size?: "sm" | "default" | "lg"
  "aria-label": string
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "default", ...props }, ref) => {
    const sizeMap = {
      sm: "icon-sm",
      default: "icon",
      lg: "icon-lg",
    } as const
    
    return (
      <Button
        ref={ref}
        size={sizeMap[size]}
        className={cn("", className)}
        {...props}
      />
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton }