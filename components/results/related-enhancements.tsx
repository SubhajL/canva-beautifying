'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, FileText, Calendar, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'

interface RelatedEnhancementsProps {
  currentEnhancementId: string
  userId: string
  documentType: string
}

interface RelatedEnhancement {
  id: string
  document_id: string
  created_at: string
  thumbnail_url?: string
  improvements?: {
    before: number
    after: number
  }
  documents: {
    name: string
    type: string
  }
}

export function RelatedEnhancements({ currentEnhancementId, userId, documentType: _documentType }: RelatedEnhancementsProps) {
  const [enhancements, setEnhancements] = useState<RelatedEnhancement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRelatedEnhancements()
  }, [currentEnhancementId, userId])

  const loadRelatedEnhancements = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Fetch other enhancements by the same user
      const { data, error } = await supabase
        .from('enhancements')
        .select(`
          id,
          document_id,
          created_at,
          thumbnail_url,
          improvements,
          documents (
            name,
            type
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .neq('id', currentEnhancementId)
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) throw error

      setEnhancements((data || []).map((item: any) => ({
        ...item,
        documents: Array.isArray(item.documents) ? item.documents[0] : item.documents
      })))
    } catch (error) {
      console.error('Error loading related enhancements:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDocumentTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      'application/pdf': 'PDF',
      'image/png': 'PNG',
      'image/jpeg': 'JPEG',
      'image/jpg': 'JPG',
      'image/webp': 'WebP',
      'application/vnd.ms-powerpoint': 'PPT',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    }
    return typeMap[type] || 'Document'
  }

  const getImprovementPercentage = (improvements?: { before: number; after: number }) => {
    if (!improvements || improvements.before === 0) return 0
    return Math.round(((improvements.after - improvements.before) / improvements.before) * 100)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Other Enhancements</CardTitle>
          <CardDescription>
            View your recent enhancement history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (enhancements.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start Enhancing More Documents</CardTitle>
          <CardDescription>
            This is your first enhancement. Upload more documents to see them here!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/dashboard">
            <Button>
              <FileText className="h-4 w-4 mr-2" />
              Upload Another Document
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Other Enhancements</CardTitle>
        <CardDescription>
          Continue working with your enhanced documents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {enhancements.map((enhancement) => {
            const improvementPercentage = getImprovementPercentage(enhancement.improvements)
            const documentType = getDocumentTypeLabel(enhancement.documents.type)
            
            return (
              <Link
                key={enhancement.id}
                href={`/app/results/${enhancement.id}`}
                className="group"
              >
                <Card className="overflow-hidden transition-shadow hover:shadow-lg cursor-pointer">
                  {/* Thumbnail */}
                  <div className="relative h-32 bg-gray-100">
                    {enhancement.thumbnail_url ? (
                      <Image
                        src={enhancement.thumbnail_url}
                        alt={enhancement.documents.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <FileText className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-black/70 text-white">
                        {documentType}
                      </Badge>
                    </div>
                  </div>

                  {/* Details */}
                  <CardContent className="p-4">
                    <h4 className="font-medium text-sm truncate mb-2">
                      {enhancement.documents.name}
                    </h4>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(enhancement.created_at).toLocaleDateString()}
                      </div>
                      {improvementPercentage > 0 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <TrendingUp className="h-3 w-3" />
                          +{improvementPercentage}%
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    >
                      View Results
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="mt-6 text-center">
          <Link href="/app/dashboard">
            <Button variant="outline">
              View All Enhancements
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}