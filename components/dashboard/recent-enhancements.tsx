"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  Image as ImageIcon,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useEnhancements } from "@/hooks/use-enhancements"
import Link from "next/link"
import Image from "next/image"

export function RecentEnhancements() {
  const { enhancements, loading, error } = useEnhancements({ limit: 6 })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  const itemsPerPage = 3
  const totalPages = Math.ceil((enhancements?.length || 0) / itemsPerPage)
  const currentPage = Math.floor(currentIndex / itemsPerPage)

  const visibleEnhancements = enhancements?.slice(
    currentIndex,
    currentIndex + itemsPerPage
  )

  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - itemsPerPage))
  }

  const goToNext = () => {
    setCurrentIndex((prev) =>
      Math.min((enhancements?.length || 0) - itemsPerPage, prev + itemsPerPage)
    )
  }

  const handleImageError = (enhancementId: string) => {
    setImageErrors((prev) => ({ ...prev, [enhancementId]: true }))
  }

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Recent Enhancements</CardTitle>
          <CardDescription>Your latest enhanced documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Recent Enhancements</CardTitle>
          <CardDescription>Your latest enhanced documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Failed to load enhancements</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!enhancements || enhancements.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Recent Enhancements</CardTitle>
          <CardDescription>Your latest enhanced documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-4 text-muted-foreground">No enhancements yet</p>
            <Link href="/upload">
              <Button>Upload Your First Document</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Enhancements</CardTitle>
            <CardDescription>Your latest enhanced documents</CardDescription>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPrevious}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNext}
                disabled={
                  currentIndex + itemsPerPage >= (enhancements?.length || 0)
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {visibleEnhancements?.map((enhancement) => (
            <div
              key={enhancement.id}
              className="group relative overflow-hidden rounded-lg border bg-card transition-all duration-200 hover:shadow-md"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {enhancement.thumbnail_url && !imageErrors[enhancement.id] ? (
                  <Image
                    src={enhancement.thumbnail_url}
                    alt={enhancement.title}
                    fill
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                    onError={() => handleImageError(enhancement.id)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                {/* Status Badge */}
                <Badge
                  className="absolute right-2 top-2"
                  variant={
                    enhancement.status === "completed" ? "default" : "secondary"
                  }
                >
                  {enhancement.status}
                </Badge>

                {/* Hover Overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <Link href={`/enhance/${enhancement.id}`}>
                    <Button size="sm" variant="secondary">
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                  </Link>
                  {enhancement.enhanced_url && (
                    <Button size="sm" variant="secondary" asChild>
                      <a href={enhancement.enhanced_url} download>
                        <Download className="mr-1 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="mb-1 truncate text-sm font-semibold">
                  {enhancement.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(enhancement.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                {enhancement.enhancement_type && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    {enhancement.enhancement_type}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
