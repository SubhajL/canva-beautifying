import * as React from "react"
import { cn } from "@/lib/utils"
import { Container } from "./container"

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  containerSize?: "sm" | "md" | "lg" | "xl" | "full"
  spacing?: "none" | "sm" | "default" | "lg" | "xl"
  background?: "default" | "muted" | "card" | "primary" | "secondary"
}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ 
    className, 
    containerSize = "lg",
    spacing = "default",
    background = "default",
    children,
    ...props 
  }, ref) => {
    const spacingClasses = {
      none: "py-0",
      sm: "py-8 md:py-12",
      default: "py-12 md:py-16 lg:py-20",
      lg: "py-16 md:py-20 lg:py-24",
      xl: "py-20 md:py-24 lg:py-32",
    }
    
    const backgroundClasses = {
      default: "",
      muted: "bg-muted",
      card: "bg-card",
      primary: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
    }
    
    return (
      <section
        ref={ref}
        className={cn(
          spacingClasses[spacing],
          backgroundClasses[background],
          className
        )}
        {...props}
      >
        <Container size={containerSize}>
          {children}
        </Container>
      </section>
    )
  }
)
Section.displayName = "Section"

export { Section }