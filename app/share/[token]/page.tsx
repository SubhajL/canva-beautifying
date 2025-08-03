import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Calendar, TrendingUp, Download, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface SharePageProps {
  params: Promise<{ token: string }>
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params
  const supabase = await createClient()

  // Fetch share link details
  const { data: shareLink, error: shareLinkError } = await supabase
    .from('share_links')
    .select(`
      id,
      enhancement_id,
      is_public,
      expires_at,
      created_at,
      enhancements (
        id,
        status,
        enhanced_url,
        thumbnail_url,
        improvements,
        created_at,
        completed_at,
        documents (
          name,
          type,
          size,
          original_url
        )
      )
    `)
    .eq('id', token)
    .single()

  if (shareLinkError || !shareLink) {
    notFound()
  }

  // Check if link is expired
  if (new Date(shareLink.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Link Expired</h2>
            <p className="text-muted-foreground mb-4">
              This share link has expired and is no longer accessible.
            </p>
            <Link href="/">
              <Button>Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if enhancement is complete
  const enhancement = shareLink.enhancements?.[0]
  if (!enhancement || enhancement.status !== 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Enhancement Not Ready</h2>
            <p className="text-muted-foreground mb-4">
              This enhancement is still being processed. Please check back later.
            </p>
            <Link href="/">
              <Button>Go to Homepage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const _document = enhancement.documents
  const improvements = enhancement.improvements || { before: 0, after: 0 }
  const improvementPercentage = improvements.before > 0 
    ? Math.round(((improvements.after - improvements.before) / improvements.before) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-primary">
              BeautifyAI
            </Link>
            <Link href="/signup">
              <Button>Create Your Own</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Preview */}
          <div>
            <Card className="overflow-hidden">
              <div className="relative aspect-[4/3] bg-gray-100">
                {enhancement.enhanced_url ? (
                  <Image
                    src={enhancement.enhanced_url}
                    alt={enhancement.documents?.[0]?.name || 'Enhanced document'}
                    fill
                    className="object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <FileText className="h-24 w-24 text-gray-400" />
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{enhancement.documents?.[0]?.name || 'Enhanced Document'}</h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">
                    Enhanced on {new Date(enhancement.completed_at).toLocaleDateString()}
                  </span>
                </div>
                <Badge variant="secondary">
                  {enhancement.documents?.[0]?.type.split('/').pop()?.toUpperCase() || 'DOCUMENT'}
                </Badge>
              </div>
            </div>

            {/* Improvement Stats */}
            <Card>
              <CardContent className="py-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {improvementPercentage}%
                    </div>
                    <p className="text-sm text-muted-foreground">Improvement</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl font-semibold text-red-500">
                        {improvements.before}
                      </span>
                      <TrendingUp className="h-5 w-5" />
                      <span className="text-2xl font-semibold text-green-500">
                        {improvements.after}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Quality Score</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="space-y-3">
              <Button className="w-full" size="lg" asChild>
                <a href={enhancement.enhanced_url} download={enhancement.documents?.[0]?.name || 'enhanced-document'}>
                  <Download className="h-5 w-5 mr-2" />
                  Download Enhanced Version
                </a>
              </Button>
              
              {shareLink.is_public && (
                <Button variant="outline" className="w-full" size="lg" asChild>
                  <a href={enhancement.documents?.[0]?.original_url} download={`original_${enhancement.documents?.[0]?.name || 'document'}`}>
                    <Download className="h-5 w-5 mr-2" />
                    Download Original
                  </a>
                </Button>
              )}
            </div>

            {/* CTA */}
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="py-6 text-center">
                <h3 className="text-xl font-semibold mb-2">
                  Want to enhance your own documents?
                </h3>
                <p className="mb-4 opacity-90">
                  Join BeautifyAI and transform your documents with AI-powered enhancements.
                </p>
                <Link href="/signup">
                  <Button variant="secondary" size="lg">
                    Get Started Free
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Share Info */}
            <div className="text-center text-sm text-muted-foreground">
              <p>This link expires on {new Date(shareLink.expires_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}