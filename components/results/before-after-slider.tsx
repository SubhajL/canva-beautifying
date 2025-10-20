"use client"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react"
import Image from "next/image"
import { Loading } from "@/components/ui/loading"

interface BeforeAfterSliderProps {
  beforeUrl: string
  afterUrl: string
  documentType: string
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  documentType,
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [imageLoaded, setImageLoaded] = useState({
    before: false,
    after: false,
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  const isPDF = documentType === "application/pdf"

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = (x / rect.width) * 100
      setSliderPosition(Math.max(0, Math.min(100, percentage)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging])

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return

    const touch = e.touches[0]
    const rect = containerRef.current.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const percentage = (x / rect.width) * 100
    setSliderPosition(Math.max(0, Math.min(100, percentage)))
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const renderContent = () => {
    if (isPDF) {
      return (
        <div className="relative h-full w-full bg-gray-100">
          {/* PDF Viewer would go here - for now using iframe */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <iframe
              src={`${beforeUrl}#toolbar=0`}
              className="h-full w-full border-0"
              title="Before PDF"
            />
            <div className="absolute left-4 top-4 rounded bg-black/70 px-2 py-1 text-sm text-white">
              Before
            </div>
          </div>
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
          >
            <iframe
              src={`${afterUrl}#toolbar=0`}
              className="h-full w-full border-0"
              title="After PDF"
            />
            <div className="absolute right-4 top-4 rounded bg-black/70 px-2 py-1 text-sm text-white">
              After
            </div>
          </div>
        </div>
      )
    }

    return (
      <>
        {/* Before Image */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <div className="relative h-full w-full">
            <Image
              src={beforeUrl}
              alt="Before enhancement"
              fill
              className="object-contain"
              onLoad={() =>
                setImageLoaded((prev) => ({ ...prev, before: true }))
              }
            />
            {imageLoaded.before && (
              <div className="absolute left-4 top-4 rounded bg-black/70 px-2 py-1 text-sm text-white">
                Before
              </div>
            )}
          </div>
        </div>

        {/* After Image */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
        >
          <div className="relative h-full w-full">
            <Image
              src={afterUrl}
              alt="After enhancement"
              fill
              className="object-contain"
              onLoad={() =>
                setImageLoaded((prev) => ({ ...prev, after: true }))
              }
            />
            {imageLoaded.after && (
              <div className="absolute right-4 top-4 rounded bg-black/70 px-2 py-1 text-sm text-white">
                After
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  const content = (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className={`relative cursor-ew-resize overflow-hidden rounded-lg bg-gray-50 ${
          isFullscreen ? "h-screen" : "h-[600px]"
        }`}
        onMouseDown={() => setIsDragging(true)}
        onTouchMove={handleTouchMove}
      >
        {renderContent()}

        {/* Slider Line */}
        <div
          ref={sliderRef}
          className="absolute bottom-0 top-0 w-1 bg-white shadow-lg"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 transform items-center justify-center rounded-full bg-white shadow-lg">
            <ChevronLeft className="absolute -left-1 h-4 w-4 text-gray-600" />
            <ChevronRight className="absolute -right-1 h-4 w-4 text-gray-600" />
          </div>
        </div>

        {/* Loading indicator */}
        {(!imageLoaded.before || !imageLoaded.after) && !isPDF && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <Loading size="xl" text="Loading images..." />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSliderPosition(0)}
        >
          Show Before
        </Button>
        <Slider
          value={[sliderPosition]}
          onValueChange={([value]) => setSliderPosition(value)}
          max={100}
          step={1}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSliderPosition(100)}
        >
          Show After
        </Button>
        <Button variant="outline" size="icon" onClick={toggleFullscreen}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 z-10 text-white hover:bg-white/20"
          onClick={toggleFullscreen}
        >
          <X className="h-6 w-6" />
        </Button>
        <div className="h-full p-4">{content}</div>
      </div>
    )
  }

  return <Card className="p-6">{content}</Card>
}
