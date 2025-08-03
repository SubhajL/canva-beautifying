import * as React from "react"
import NextImage from "next/image"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"
import { Badge } from "./badge"
import { Button } from "./button"
import { cn } from "@/lib/utils"
import { FileText, Image, Clock, Sparkles } from "lucide-react"

interface EnhancementCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description: string
  status: "pending" | "processing" | "completed" | "failed"
  fileType: "image" | "pdf" | "document"
  createdAt: string
  improvementScore?: number
  onView?: () => void
  onDownload?: () => void
  thumbnail?: string
}

const EnhancementCard = React.forwardRef<HTMLDivElement, EnhancementCardProps>(
  ({ 
    className, 
    title, 
    description, 
    status, 
    fileType, 
    createdAt, 
    improvementScore,
    onView,
    onDownload,
    thumbnail,
    ...props 
  }, ref) => {
    const statusColors = {
      pending: "bg-gray-100 text-gray-700",
      processing: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      failed: "bg-red-100 text-red-700",
    }
    
    const fileIcons = {
      image: Image,
      pdf: FileText,
      document: FileText,
    }
    
    const FileIcon = fileIcons[fileType]
    
    return (
      <Card 
        ref={ref} 
        variant="enhancement" 
        interactive
        className={cn("overflow-hidden", className)}
        {...props}
      >
        {thumbnail && (
          <div className="relative h-48 w-full overflow-hidden bg-gray-100">
            <NextImage 
              src={thumbnail} 
              alt={title}
              fill
              className="object-cover"
            />
            {improvementScore && (
              <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-sm text-white">
                <Sparkles className="h-3 w-3" />
                <span>{improvementScore}% improved</span>
              </div>
            )}
          </div>
        )}
        
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription className="mt-1">{description}</CardDescription>
              </div>
            </div>
            <Badge className={cn("ml-2", statusColors[status])}>
              {status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{createdAt}</span>
          </div>
        </CardContent>
        
        {(onView || onDownload) && (
          <CardFooter className="gap-2">
            {onView && (
              <Button onClick={onView} variant="default" size="sm" className="flex-1">
                View
              </Button>
            )}
            {onDownload && (
              <Button onClick={onDownload} variant="outline" size="sm" className="flex-1">
                Download
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    )
  }
)
EnhancementCard.displayName = "EnhancementCard"

export { EnhancementCard }