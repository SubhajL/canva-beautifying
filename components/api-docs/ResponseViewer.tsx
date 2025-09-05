'use client'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Check, Clock, Copy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface ResponseViewerProps {
  status: number | null
  response: unknown | null
  error: string | null
  headers: Record<string, string> | null
  duration: number | null
  className?: string
}

export function ResponseViewer({
  status,
  response,
  error,
  headers,
  duration,
  className
}: ResponseViewerProps) {
  const [copiedTab, setCopiedTab] = useState<string | null>(null)

  const getStatusBadgeVariant = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'default'
    if (statusCode >= 300 && statusCode < 400) return 'secondary'
    if (statusCode >= 400 && statusCode < 500) return 'destructive'
    if (statusCode >= 500) return 'destructive'
    return 'secondary'
  }

  const getStatusIcon = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) {
      return <Check className="h-3 w-3" />
    }
    return <X className="h-3 w-3" />
  }

  const formatResponse = (data: unknown): string => {
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data, null, 2)
    }
    return String(data)
  }

  const copyToClipboard = async (text: string, tab: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedTab(tab)
      setTimeout(() => setCopiedTab(null), 2000)
    } catch (_error) {
      console.error('Failed to copy')
    }
  }

  if (!status && !error) {
    return (
      <div className={cn("text-center py-12 text-gray-500 dark:text-gray-400", className)}>
        <p className="text-sm">No response yet. Send a request to see the results here.</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status && (
            <Badge
              variant={getStatusBadgeVariant(status)}
              className="flex items-center gap-1"
            >
              {getStatusIcon(status)}
              {status}
            </Badge>
          )}
          {duration && (
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="h-3 w-3" />
              {duration}ms
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Response Content */}
      {!error && response !== null && (
        <Tabs defaultValue="body" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="body">Response Body</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
          </TabsList>

          <TabsContent value="body" className="relative">
            <div className="absolute top-2 right-2 z-10">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => copyToClipboard(formatResponse(response), 'body')}
              >
                {copiedTab === 'body' ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-auto max-h-[500px]">
              <pre className="text-sm text-gray-300 font-mono">
                {formatResponse(response)}
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="headers" className="relative">
            {headers && Object.keys(headers).length > 0 ? (
              <>
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(JSON.stringify(headers, null, 2), 'headers')}
                  >
                    {copiedTab === 'headers' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
                  {Object.entries(headers).map(([key, value]) => (
                    <div key={key} className="flex gap-2 font-mono text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {key}:
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 break-all">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No headers available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Empty Success Response */}
      {!error && response === null && status && status >= 200 && status < 300 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">Request completed successfully with no response body</p>
        </div>
      )}
    </div>
  )
}