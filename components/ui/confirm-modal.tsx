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
import { AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface ConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel?: () => void
  variant?: "default" | "destructive" | "warning" | "info" | "success"
  loading?: boolean
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
  loading = false,
}) => {
  const icons = {
    default: null,
    destructive: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle,
  }
  
  const iconColors = {
    default: "",
    destructive: "text-destructive",
    warning: "text-warning",
    info: "text-info",
    success: "text-success",
  }
  
  const buttonVariants = {
    default: "default" as const,
    destructive: "destructive" as const,
    warning: "warning" as const,
    info: "default" as const,
    success: "success" as const,
  }
  
  const Icon = icons[variant]
  
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      onOpenChange(false)
    }
  }
  
  const handleConfirm = () => {
    onConfirm()
    if (!loading) {
      onOpenChange(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {Icon && (
              <div className={cn(
                "rounded-lg p-2",
                variant === "default" ? "bg-primary/10" : "bg-gray-100 dark:bg-gray-800"
              )}>
                <Icon className={cn("h-5 w-5", iconColors[variant])} />
              </div>
            )}
            <div className="flex-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-2">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={buttonVariants[variant]}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmModal }