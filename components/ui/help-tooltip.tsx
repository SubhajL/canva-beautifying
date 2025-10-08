'use client'

import * as React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'

type HelpTooltipProps = {
  text: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function HelpTooltip({ text, side = 'top' }: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            aria-label="Help"
            className="inline-flex cursor-pointer items-center text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <HelpCircle className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-sm" role="tooltip">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
