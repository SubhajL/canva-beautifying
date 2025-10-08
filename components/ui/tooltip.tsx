"use client"

// Minimal tooltip API shim to avoid extra deps in tests/build
import * as React from 'react'

const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>
const Tooltip = ({ children }: { children: React.ReactNode }) => <>{children}</>
type TriggerProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean
  children?: React.ReactElement
}

const TooltipTrigger = React.forwardRef<any, TriggerProps>(({ asChild, children, ...rest }, ref) => {
  if (asChild && children && React.isValidElement(children)) {
    return React.cloneElement(children, { ref, ...rest })
  }
  return <button ref={ref} {...rest} />
})
TooltipTrigger.displayName = 'TooltipTrigger'
const TooltipContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(({ className, ...props }, ref) => (
  <div ref={ref} className={className} {...props} />
))
TooltipContent.displayName = 'TooltipContent'

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
