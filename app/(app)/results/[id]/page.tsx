"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Palette,
  Type,
  Sparkles,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { BeforeAfterSlider } from "@/components/results/before-after-slider"
import { EnhancementReport } from "@/components/results/enhancement-report"
import { ShareDownloadSplit } from "@/components/results/share-download-split"
import { FeedbackForm } from "@/components/results/feedback-form"
import { RelatedEnhancements } from "@/components/results/related-enhancements"
import { useAuth } from "@/contexts/auth-context"

interface ResultsPageProps {
  params: { id: string }
}

interface Enhancement {
  id: string
  user_id: string
  document_id: string
  status: "pending" | "processing" | "completed" | "failed"
  enhanced_url?: string
  report_url?: string
  enhancement_data?: {
    summary?: string
    improvements?: Array<{
      category: string
      description: string
      impact: number
    }>
    metadata?: Record<string, unknown>
  }
  analysis_data?: any
  improvements?: {
    before: number
    after: number
  }
  enhancements_applied?: string[]
  processing_time?: number
  settings?: {
    enhancementSettings?: {
      style?: string
      targetAudience?: string
    }
  }
  created_at: string
  completed_at?: string
  documents?: Document
}

interface Document {
  id: string
  name: string
  type: string
  size: number
  original_url: string
}

export default function ResultsPage({ params }: ResultsPageProps) {
  const { id } = params
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [enhancement, setEnhancement] = useState<Enhancement | null>(null)
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [activeTab, setActiveTab] = useState("comparison")

  useEffect(() => {
    // Wait for auth to load before fetching enhancement data
    if (!authLoading) {
      loadEnhancementData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authLoading])

  const loadEnhancementData = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Fetch enhancement data
      const { data: enhancementData, error: enhError } = await supabase
        .from("enhancements")
        .select(
          `
          *,
          documents (
            id,
            name,
            type,
            size,
            original_url
          )
        `
        )
        .eq("id", id)
        .single()

      if (enhError) throw enhError

      // Verify ownership
      if (!user || enhancementData.user_id !== user.id) {
        throw new Error("Unauthorized access")
      }

      // Check if enhancement is complete
      if (enhancementData.status !== "completed") {
        router.push(`/app/enhance/${enhancementData.document_id}`)
        return
      }

      setEnhancement(enhancementData)
      setDocument(enhancementData.documents)
    } catch (err) {
      console.error("Error loading results:", err)
      setError(err instanceof Error ? err.message : "Failed to load results")
    } finally {
      setLoading(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-gray-200"></div>
          <div className="h-96 rounded bg-gray-200"></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="h-32 rounded bg-gray-200"></div>
            <div className="h-32 rounded bg-gray-200"></div>
            <div className="h-32 rounded bg-gray-200"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h2 className="mb-2 text-xl font-semibold">
              Error Loading Results
            </h2>
            <p className="text-muted-foreground">{error}</p>
            <Button
              onClick={() => router.push("/app/dashboard")}
              className="mt-4"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!enhancement || !document) {
    return null
  }

  const improvements = enhancement.improvements || { before: 0, after: 0 }
  const improvementPercentage =
    improvements.before > 0
      ? Math.round(
          ((improvements.after - improvements.before) / improvements.before) *
            100
        )
      : 0

  return (
    <div className="container mx-auto space-y-6 py-8">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="mb-2 text-3xl font-bold">Enhancement Results</h1>
          <p className="text-muted-foreground">{document.name}</p>
        </div>
        <ShareDownloadSplit
          enhancementId={enhancement.id}
          documentName={document.name}
          enhancedUrl={enhancement.enhanced_url!}
          originalUrl={document.original_url}
          reportUrl={enhancement.report_url}
        />
      </div>

      {/* Improvement Summary */}
      <Card>
        <CardContent className="py-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
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
                <ArrowRight className="h-5 w-5" />
                <span className="text-2xl font-semibold text-green-500">
                  {improvements.after}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Quality Score</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">
                {enhancement.enhancements_applied?.length || 0}
              </div>
              <p className="text-sm text-muted-foreground">
                Enhancements Applied
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold">
                {Math.round((enhancement.processing_time || 0) / 1000)}s
              </div>
              <p className="text-sm text-muted-foreground">Processing Time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="comparison">Before & After</TabsTrigger>
          <TabsTrigger value="report">Enhancement Report</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-4">
          <BeforeAfterSlider
            beforeUrl={document.original_url}
            afterUrl={enhancement.enhanced_url!}
            documentType={document.type}
          />

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Applied Enhancements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {enhancement.enhancements_applied?.map(
                    (item: string, index: number) => (
                      <Badge key={index} variant="secondary">
                        {item}
                      </Badge>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Enhancement Style</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">
                    {enhancement.settings?.enhancementSettings?.style || "Auto"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Target Audience</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">
                    {enhancement.settings?.enhancementSettings
                      ?.targetAudience || "General"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="report">
          <EnhancementReport
            enhancementId={enhancement.id}
            reportData={enhancement.enhancement_data}
            reportUrl={enhancement.report_url}
          />
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {/* Enhancement Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Enhancement Details
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? <ChevronUp /> : <ChevronDown />}
                </Button>
              </CardTitle>
            </CardHeader>
            {showDetails && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Enhancement ID</p>
                    <p className="text-muted-foreground">{enhancement.id}</p>
                  </div>
                  <div>
                    <p className="font-medium">Document ID</p>
                    <p className="text-muted-foreground">{document.id}</p>
                  </div>
                  <div>
                    <p className="font-medium">Created</p>
                    <p className="text-muted-foreground">
                      {new Date(enhancement.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Completed</p>
                    <p className="text-muted-foreground">
                      {new Date(enhancement.completed_at || enhancement.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">File Type</p>
                    <p className="text-muted-foreground">{document.type}</p>
                  </div>
                  <div>
                    <p className="font-medium">File Size</p>
                    <p className="text-muted-foreground">
                      {(document.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                {enhancement.settings && (
                  <div>
                    <p className="mb-2 font-medium">Settings Used</p>
                    <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(enhancement.settings, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Further Enhancement Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle>Further Enhancement Suggestions</CardTitle>
              <CardDescription>
                Based on the analysis, here are additional improvements you
                could make
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {enhancement.enhancement_data?.improvements &&
                enhancement.enhancement_data.improvements.length > 0 ? (
                  enhancement.enhancement_data.improvements
                    .slice(0, 5)
                    .map((improvement, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">{improvement.category}</p>
                          <p className="text-sm text-muted-foreground">
                            {improvement.description}
                          </p>
                          {improvement.impact && (
                            <div className="mt-1">
                              <span className="text-xs text-muted-foreground">
                                Impact: {Math.round(improvement.impact * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No additional suggestions available at this time.
                  </p>
                )}
                <Button className="mt-4 w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Enhance Again with Different Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Feedback Form */}
          <FeedbackForm
            enhancementId={enhancement.id}
            userId={user?.id || ""}
          />
        </TabsContent>
      </Tabs>

      {/* Related Enhancements */}
      <RelatedEnhancements
        currentEnhancementId={enhancement.id}
        userId={user?.id || ""}
        documentType={document.type}
      />
    </div>
  )
}
