import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface FeatureCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description: string
  icon: LucideIcon
  iconColor?: string
  iconBgColor?: string
}

const FeatureCard = React.forwardRef<HTMLDivElement, FeatureCardProps>(
  ({ 
    className, 
    title, 
    description, 
    icon: Icon,
    iconColor = "text-primary",
    iconBgColor = "bg-primary/10",
    ...props 
  }, ref) => {
    return (
      <Card 
        ref={ref} 
        variant="feature"
        className={cn("group", className)}
        {...props}
      >
        <CardHeader>
          <div className={cn(
            "mb-4 inline-flex rounded-lg p-3 transition-all duration-base",
            iconBgColor,
            "group-hover:scale-110"
          )}>
            <Icon className={cn("h-6 w-6", iconColor)} />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-base">
            {description}
          </CardDescription>
        </CardContent>
      </Card>
    )
  }
)
FeatureCard.displayName = "FeatureCard"

export { FeatureCard }