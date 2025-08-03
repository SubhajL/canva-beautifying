import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { Button } from "./button"
import { CheckCircle, Sparkles, Trophy, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import confetti from "canvas-confetti"

interface SuccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: "default" | "outline" | "ghost"
  }>
  icon?: "check" | "sparkles" | "trophy" | "zap"
  showConfetti?: boolean
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  actions = [],
  icon = "check",
  showConfetti = true,
}) => {
  const icons = {
    check: CheckCircle,
    sparkles: Sparkles,
    trophy: Trophy,
    zap: Zap,
  }
  
  const Icon = icons[icon]
  
  React.useEffect(() => {
    if (open && showConfetti && typeof window !== "undefined") {
      // Fire confetti
      const duration = 3 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
      
      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min
      }
      
      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now()
        
        if (timeLeft <= 0) {
          return clearInterval(interval)
        }
        
        const particleCount = 50 * (timeLeft / duration)
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        })
      }, 250)
      
      return () => clearInterval(interval)
    }
  }, [open, showConfetti])
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <Icon className="h-10 w-10 text-success" />
          </div>
          <DialogTitle className="text-center text-2xl">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        {actions.length > 0 && (
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || (index === 0 ? "default" : "outline")}
                onClick={() => {
                  action.onClick()
                  onOpenChange(false)
                }}
                className={cn(
                  "w-full",
                  index === 0 && actions.length > 1 && "sm:mb-2"
                )}
              >
                {action.label}
              </Button>
            ))}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { SuccessModal }