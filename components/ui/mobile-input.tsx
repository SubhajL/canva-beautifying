import * as React from "react"
import { cn } from "@/lib/utils"
import { useIsTouchDevice } from "@/lib/utils/responsive"

export interface MobileInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  error?: boolean
  touched?: boolean
}

const MobileInput = React.forwardRef<HTMLInputElement, MobileInputProps>(
  ({ className, type, icon, error, touched, ...props }, ref) => {
    const isTouchDevice = useIsTouchDevice()
    
    // Mobile-optimized input attributes
    const mobileProps = isTouchDevice ? {
      // Add appropriate input modes for mobile keyboards
      inputMode: (type === 'email' ? 'email' : 
                 type === 'tel' ? 'tel' :
                 type === 'url' ? 'url' :
                 type === 'number' ? 'numeric' :
                 type === 'search' ? 'search' : 'text') as React.HTMLAttributes<HTMLInputElement>['inputMode'],
      // Add autocomplete hints
      autoComplete: props.autoComplete || 
                   (type === 'email' ? 'email' :
                    type === 'tel' ? 'tel' :
                    type === 'password' ? 'current-password' : 'on'),
      // Prevent zoom on iOS
      style: { fontSize: '16px', ...props.style }
    } : {}
    
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex w-full rounded-md border border-input bg-background text-base ring-offset-background",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Mobile-optimized sizing
            isTouchDevice ? "h-12 px-4 py-3" : "h-10 px-3 py-2",
            // Icon padding
            icon && (isTouchDevice ? "pl-12" : "pl-10"),
            // Error states
            error && touched && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          {...mobileProps}
          {...props}
        />
      </div>
    )
  }
)
MobileInput.displayName = "MobileInput"

// Mobile-optimized textarea
export interface MobileTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
  touched?: boolean
}

const MobileTextarea = React.forwardRef<HTMLTextAreaElement, MobileTextareaProps>(
  ({ className, error, touched, ...props }, ref) => {
    const isTouchDevice = useIsTouchDevice()
    
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background text-base ring-offset-background",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-y",
          // Mobile-optimized sizing
          isTouchDevice ? "px-4 py-3" : "px-3 py-2",
          // Error states
          error && touched && "border-destructive focus-visible:ring-destructive",
          // Prevent zoom on iOS
          isTouchDevice && "text-base",
          className
        )}
        ref={ref}
        style={isTouchDevice ? { fontSize: '16px', ...props.style } : props.style}
        {...props}
      />
    )
  }
)
MobileTextarea.displayName = "MobileTextarea"

// Mobile-optimized select
export interface MobileSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode
  error?: boolean
  touched?: boolean
}

const MobileSelect = React.forwardRef<HTMLSelectElement, MobileSelectProps>(
  ({ className, icon, error, touched, children, ...props }, ref) => {
    const isTouchDevice = useIsTouchDevice()
    
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <select
          className={cn(
            "flex w-full rounded-md border border-input bg-background text-base ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "appearance-none cursor-pointer",
            // Mobile-optimized sizing
            isTouchDevice ? "h-12 px-4 py-3 pr-10" : "h-10 px-3 py-2 pr-8",
            // Icon padding
            icon && (isTouchDevice ? "pl-12" : "pl-10"),
            // Error states
            error && touched && "border-destructive focus-visible:ring-destructive",
            className
          )}
          ref={ref}
          style={isTouchDevice ? { fontSize: '16px', ...props.style } : props.style}
          {...props}
        >
          {children}
        </select>
        {/* Custom arrow */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="h-4 w-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    )
  }
)
MobileSelect.displayName = "MobileSelect"

export { MobileInput, MobileTextarea, MobileSelect }