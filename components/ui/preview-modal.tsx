import * as React from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { Button } from "./button"
import { cn } from "@/lib/utils"
import { Download, Maximize2 } from "lucide-react"

interface PreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fileUrl: string
  fileType: "image" | "pdf" | "document"
  onDownload?: () => void
  className?: string
}

const PreviewModal: React.FC<PreviewModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  fileUrl,
  fileType,
  onDownload,
  className,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }
  
  const renderPreview = () => {
    switch (fileType) {
      case "image":
        return (
          <div className="relative h-full w-full">
            <Image
              src={fileUrl}
              alt={title}
              fill
              className="object-contain"
            />
          </div>
        )
      case "pdf":
        return (
          <iframe
            src={fileUrl}
            title={title}
            className="h-full w-full"
            style={{ minHeight: "600px" }}
          />
        )
      case "document":
        return (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center">
              <p className="text-muted-foreground">
                Document preview not available
              </p>
              {onDownload && (
                <Button
                  onClick={onDownload}
                  variant="outline"
                  className="mt-4"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download to view
                </Button>
              )}
            </div>
          </div>
        )
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-4xl",
          isFullscreen && "h-screen max-h-screen w-screen max-w-none rounded-none",
          className
        )}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className={cn(
          "relative overflow-hidden rounded-md bg-gray-50 dark:bg-gray-900",
          isFullscreen ? "h-[calc(100vh-120px)]" : "h-[600px]"
        )}>
          {renderPreview()}
        </div>
        
        {onDownload && (
          <DialogFooter>
            <Button onClick={onDownload} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { PreviewModal }