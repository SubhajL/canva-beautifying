"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, FileText, Calendar, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"

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

export function RelatedEnhancements({
  currentEnhancementId,
  userId,
  documentType: _documentType,
}: RelatedEnhancementsProps) {
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
        .from("enhancements")
        .select(
          `
          id,
          document_id,
          created_at,
          thumbnail_url,
          improvements,
          documents (
            name,
            type
          )
        `
        )
        .eq("user_id", userId)
        .eq("status", "completed")
        .neq("id", currentEnhancementId)
        .order("created_at", { ascending: false })
        .limit(6)

      if (error) throw error

      setEnhancements(
        (data || []).map((item: any) => ({
          ...item,
          documents: Array.isArray(item.documents)
            ? item.documents[0]
            : item.documents,
        }))
      )
    } catch (error) {
      console.error("Error loading related enhancements:", error)
    } finally {
      setLoading(false)
    }
  }

  const getDocumentTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      "application/pdf": "PDF",
      "image/png": "PNG",
      "image/jpeg": "JPEG",
      "image/jpg": "JPG",
      "image/webp": "WebP",
      "application/vnd.ms-powerpoint": "PPT",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "PPTX",
    }
    return typeMap[type] || "Document"
  }

  const getImprovementPercentage = (improvements?: {
    before: number
    after: number
  }) => {
    if (!improvements || improvements.before === 0) return 0
    return Math.round(
      ((improvements.after - improvements.before) / improvements.before) * 100
    )
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="mb-2 h-32 rounded-lg bg-gray-200"></div>
                <div className="mb-1 h-4 w-3/4 rounded bg-gray-200"></div>
                <div className="h-3 w-1/2 rounded bg-gray-200"></div>
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
            This is your first enhancement. Upload more documents to see them
            here!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/app/dashboard">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {enhancements.map((enhancement) => {
            const improvementPercentage = getImprovementPercentage(
              enhancement.improvements
            )
            const documentType = getDocumentTypeLabel(
              enhancement.documents.type
            )

            return (
              <Link
                key={enhancement.id}
                href={`/app/results/${enhancement.id}`}
                className="group"
              >
                <Card className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg">
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
                      <div className="flex h-full items-center justify-center">
                        <FileText className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute right-2 top-2">
                      <Badge
                        variant="secondary"
                        className="bg-black/70 text-white"
                      >
                        {documentType}
                      </Badge>
                    </div>
                  </div>

                  {/* Details */}
                  <CardContent className="p-4">
                    <h4 className="mb-2 truncate text-sm font-medium">
                      {enhancement.documents.name}
                    </h4>

                    <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(enhancement.created_at).toLocaleDateString()}
                      </div>
                      {improvementPercentage > 0 && (
                        <div className="flex items-center gap-1 text-green-600">
                          <TrendingUp className="h-3 w-3" />+
                          {improvementPercentage}%
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                    >
                      View Results
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="mt-6 text-center">
          <Link href="/app/dashboard">
            <Button variant="outline">View All Enhancements</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
