import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useIsTouchDevice } from "@/lib/utils/responsive"

const mobileButtonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 transition-transform",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        // Mobile-optimized sizes with 44px minimum touch targets
        mobile: "min-h-[44px] px-6 py-3",
        mobileSm: "min-h-[44px] px-4 py-2",
        mobileLg: "min-h-[48px] px-8 py-4",
        mobileIcon: "h-[44px] w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface MobileButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof mobileButtonVariants> {
  asChild?: boolean
  autoMobileSize?: boolean
}

const MobileButton = React.forwardRef<HTMLButtonElement, MobileButtonProps>(
  ({ className, variant, size, asChild = false, autoMobileSize = true, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isTouchDevice = useIsTouchDevice()
    
    // Auto-apply mobile sizes on touch devices if enabled
    let actualSize = size
    if (autoMobileSize && isTouchDevice && size) {
      const sizeMap: Record<string, string> = {
        default: "mobile",
        sm: "mobileSm",
        lg: "mobileLg",
        icon: "mobileIcon",
      }
      actualSize = (sizeMap[size] || size) as any
    }
    
    return (
      <Comp
        className={cn(mobileButtonVariants({ variant, size: actualSize, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
MobileButton.displayName = "MobileButton"

export { MobileButton, mobileButtonVariants }