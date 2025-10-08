'use client'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Share2, ChevronDown, Link as LinkIcon, Twitter, Facebook } from 'lucide-react'
import { DownloadOptions } from './download-options'
import { HelpTooltip } from '@/components/ui/help-tooltip'

type Props = {
  enhancementId: string
  documentName: string
  enhancedUrl: string
  originalUrl: string
  reportUrl?: string
  onOpenShare?: () => void
}

export function ShareDownloadSplit({ enhancementId, documentName, enhancedUrl, originalUrl, reportUrl, onOpenShare }: Props) {
  return (
    <div className="inline-flex" data-testid="share-download-split">
      <DownloadOptions
        enhancementId={enhancementId}
        documentName={documentName}
        enhancedUrl={enhancedUrl}
        originalUrl={originalUrl}
        reportUrl={reportUrl}
        trigger={<Button>Download</Button>}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="Open share menu" data-testid="split-caret">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onOpenShare} data-testid="menu-share">
            <Share2 className="h-4 w-4 mr-2" /> Share…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(window.location.href)} data-testid="menu-copy-link">
            <LinkIcon className="h-4 w-4 mr-2" /> Copy link
            <span className="ml-auto">
              <HelpTooltip text="Copy a link to share your results. Link inherits current page context." />
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`, '_blank')}>
            <Twitter className="h-4 w-4 mr-2" /> Share on Twitter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}>
            <Facebook className="h-4 w-4 mr-2" /> Share on Facebook
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
