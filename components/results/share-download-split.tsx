"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2 } from "lucide-react"
import { ShareDialog } from "./share-dialog"
import { DownloadOptions } from "./download-options"
import { useDensity } from "@/contexts/density"
import { getDensityString } from "@/lib/ui/density"

interface ShareDownloadSplitProps {
  enhancementId: string
  documentName: string
  enhancedUrl: string
  originalUrl: string
  reportUrl?: string
}

export function ShareDownloadSplit({
  enhancementId,
  documentName,
  enhancedUrl,
  originalUrl,
  reportUrl,
}: ShareDownloadSplitProps) {
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const { mode } = useDensity()

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setShareDialogOpen(true)
    }
  }

  return (
    <>
      <div
        className={`flex items-center ${getDensityString(mode)}`}
        data-density={mode}
      >
        <Button
          variant="outline"
          onClick={() => setShareDialogOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Share enhancement results"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>

        <DownloadOptions
          enhancementId={enhancementId}
          documentName={documentName}
          enhancedUrl={enhancedUrl}
          originalUrl={originalUrl}
          reportUrl={reportUrl}
        />
      </div>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        enhancementId={enhancementId}
        documentName={documentName}
      />
    </>
  )
}
