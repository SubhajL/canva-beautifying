import * as React from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"
import { Badge } from "./badge"
import { Button } from "./button"
import { cn } from "@/lib/utils"
import { Check, X } from "lucide-react"

interface PricingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description: string
  price: string
  period?: string
  features: Array<{ text: string; included: boolean }>
  highlighted?: boolean
  badge?: string
  buttonText?: string
  onSelect?: () => void
}

const PricingCard = React.forwardRef<HTMLDivElement, PricingCardProps>(
  ({ 
    className, 
    title, 
    description, 
    price, 
    period = "/month",
    features,
    highlighted = false,
    badge,
    buttonText = "Get Started",
    onSelect,
    ...props 
  }, ref) => {
    return (
      <Card 
        ref={ref} 
        variant={highlighted ? "pricing" : "outline"}
        className={cn(
          "relative",
          highlighted && "border-primary scale-105",
          className
        )}
        {...props}
      >
        {badge && (
          <Badge 
            className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground"
          >
            {badge}
          </Badge>
        )}
        
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        
        <CardContent className="text-center">
          <div className="mb-6">
            <span className="text-4xl font-bold">{price}</span>
            <span className="text-muted-foreground">{period}</span>
          </div>
          
          <ul className="space-y-3 text-left">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-3">
                {feature.included ? (
                  <Check className="h-5 w-5 shrink-0 text-success" />
                ) : (
                  <X className="h-5 w-5 shrink-0 text-muted-foreground/50" />
                )}
                <span className={cn(
                  feature.included ? "" : "text-muted-foreground line-through"
                )}>
                  {feature.text}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
        
        <CardFooter>
          <Button 
            onClick={onSelect}
            variant={highlighted ? "default" : "outline"}
            size="lg"
            className="w-full"
          >
            {buttonText}
          </Button>
        </CardFooter>
      </Card>
    )
  }
)
PricingCard.displayName = "PricingCard"

export { PricingCard }