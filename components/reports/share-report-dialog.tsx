'use client'

import { useState } from 'react'
import { useReports } from '@/hooks/use-reports'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Check, Lock } from 'lucide-react'
import { ShareableReportLink } from '@/lib/reports/types'

interface ShareReportDialogProps {
  reportId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShareReportDialog({ reportId, open, onOpenChange }: ShareReportDialogProps) {
  const { createShareableLink, loading } = useReports()
  const [shareableLink, setShareableLink] = useState<ShareableReportLink | null>(null)
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState('7')
  const [copied, setCopied] = useState(false)

  const handleCreateLink = async () => {
    const link = await createShareableLink(
      reportId,
      parseInt(expiresInDays),
      usePassword ? password : undefined
    )
    if (link) {
      setShareableLink(link)
    }
  }

  const handleCopyLink = async () => {
    if (shareableLink) {
      await navigator.clipboard.writeText(shareableLink.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after dialog closes
    setTimeout(() => {
      setShareableLink(null)
      setPassword('')
      setUsePassword(false)
      setExpiresInDays('7')
      setCopied(false)
    }, 200)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Report</DialogTitle>
          <DialogDescription>
            Create a shareable link to this report. Anyone with the link can view it.
          </DialogDescription>
        </DialogHeader>

        {!shareableLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expiry">Link expires in</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger id="expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password-toggle">Password protection</Label>
                <Switch
                  id="password-toggle"
                  checked={usePassword}
                  onCheckedChange={setUsePassword}
                />
              </div>
              {usePassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Recipients will need this password to view the report
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Your shareable link has been created! It will expire on{' '}
                {shareableLink.expiresAt ? new Date(shareableLink.expiresAt).toLocaleDateString() : 'never'}.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Shareable link</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={shareableLink.url}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {shareableLink.password && (
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  This link is password protected. Share the password separately: <strong>{password}</strong>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {!shareableLink ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateLink} 
                disabled={loading || (usePassword && !password)}
              >
                Create Link
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}