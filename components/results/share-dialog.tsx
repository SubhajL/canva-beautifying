'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Copy, 
  Mail, 
  Link2, 
  QrCode,
  Download,
  CheckCircle,
  Twitter,
  Linkedin,
  Facebook
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  enhancementId: string
  documentName: string
}

export function ShareDialog({ open, onOpenChange, enhancementId, documentName }: ShareDialogProps) {
  const { toast } = useToast()
  const [shareUrl, setShareUrl] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [expiryDays, setExpiryDays] = useState(7)

  const generateShareLink = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Create a share token
      const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiryDays)

      // Store share token in database
      const { error } = await supabase
        .from('share_links')
        .insert({
          id: shareToken,
          enhancement_id: enhancementId,
          is_public: isPublic,
          expires_at: expiresAt.toISOString(),
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })

      if (error) throw error

      // Generate URL
      const url = `${window.location.origin}/share/${shareToken}`
      setShareUrl(url)

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      })
      setQrCodeUrl(qrDataUrl)

      toast({
        title: 'Share Link Created',
        description: 'Your share link has been generated successfully.',
      })
    } catch (error) {
      console.error('Error creating share link:', error)
      toast({
        title: 'Error',
        description: 'Failed to create share link. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast({
        title: 'Copied!',
        description: 'Share link copied to clipboard.',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Check out my enhanced document: ${documentName}`)
    const body = encodeURIComponent(`I've enhanced my document using BeautifyAI. Take a look at the results: ${shareUrl}`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const shareOnSocial = (platform: string) => {
    const text = encodeURIComponent(`Check out my enhanced document using BeautifyAI!`)
    const url = encodeURIComponent(shareUrl)

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    }

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400')
    }
  }

  const downloadQRCode = () => {
    const link = document.createElement('a')
    link.download = `${documentName}_qr_code.png`
    link.href = qrCodeUrl
    link.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Enhancement Results</DialogTitle>
          <DialogDescription>
            Share your enhanced document with others via link, email, or social media.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">Link</TabsTrigger>
            <TabsTrigger value="qr">QR Code</TabsTrigger>
            <TabsTrigger value="social">Social</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4">
            {!shareUrl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="public-share">Public Access</Label>
                  <Switch
                    id="public-share"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {isPublic 
                    ? 'Anyone with the link can view this enhancement'
                    : 'Only users with an account can view this enhancement'}
                </p>

                <div>
                  <Label htmlFor="expiry">Link Expiry</Label>
                  <select
                    id="expiry"
                    className="w-full mt-2 px-3 py-2 border rounded-md"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                  >
                    <option value={1}>1 day</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>

                <Button 
                  onClick={generateShareLink} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Generate Share Link
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input value={shareUrl} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={shareViaEmail}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Share via Email
                </Button>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShareUrl('')
                    setQrCodeUrl('')
                  }}
                >
                  Generate New Link
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="qr" className="space-y-4">
            {!qrCodeUrl ? (
              <div className="text-center py-8">
                <QrCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  Generate a share link first to create a QR code
                </p>
                <Button onClick={generateShareLink} disabled={loading}>
                  Generate Share Link
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border">
                  <div className="relative w-full max-w-[256px] h-[256px] mx-auto">
                    <Image
                      src={qrCodeUrl}
                      alt="QR Code"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={downloadQRCode}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            {!shareUrl ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Generate a share link first to share on social media
                </p>
                <Button onClick={generateShareLink} disabled={loading}>
                  Generate Share Link
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => shareOnSocial('twitter')}
                >
                  <Twitter className="h-4 w-4 mr-2" />
                  Share on Twitter
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => shareOnSocial('linkedin')}
                >
                  <Linkedin className="h-4 w-4 mr-2" />
                  Share on LinkedIn
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => shareOnSocial('facebook')}
                >
                  <Facebook className="h-4 w-4 mr-2" />
                  Share on Facebook
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}