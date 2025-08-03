'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Star, ThumbsUp, Send } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'

interface FeedbackFormProps {
  enhancementId: string
  userId: string
}

export function FeedbackForm({ enhancementId, userId }: FeedbackFormProps) {
  const { toast } = useToast()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [satisfaction, setSatisfaction] = useState('')
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please provide a rating before submitting.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      const supabase = createClient()

      const { error } = await supabase
        .from('enhancement_feedback')
        .insert({
          enhancement_id: enhancementId,
          user_id: userId,
          rating,
          satisfaction,
          comments,
        })

      if (error) throw error

      setSubmitted(true)
      toast({
        title: 'Thank You!',
        description: 'Your feedback has been submitted successfully.',
      })
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit feedback. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
            <ThumbsUp className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Thank You for Your Feedback!</h3>
          <p className="text-muted-foreground">
            Your input helps us improve our enhancement algorithms.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate Your Enhancement</CardTitle>
        <CardDescription>
          Help us improve by sharing your feedback about this enhancement
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Star Rating */}
        <div>
          <Label className="text-base">Overall Rating</Label>
          <div className="flex gap-1 mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-colors"
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= (hoveredRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {rating === 0 && 'Click to rate'}
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </p>
        </div>

        {/* Satisfaction Level */}
        <div className="space-y-3">
          <Label className="text-base">How satisfied are you with the results?</Label>
          <RadioGroup value={satisfaction} onValueChange={setSatisfaction}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="very-satisfied" id="very-satisfied" />
              <Label htmlFor="very-satisfied" className="cursor-pointer">
                Very Satisfied
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="satisfied" id="satisfied" />
              <Label htmlFor="satisfied" className="cursor-pointer">
                Satisfied
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="neutral" id="neutral" />
              <Label htmlFor="neutral" className="cursor-pointer">
                Neutral
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dissatisfied" id="dissatisfied" />
              <Label htmlFor="dissatisfied" className="cursor-pointer">
                Dissatisfied
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="very-dissatisfied" id="very-dissatisfied" />
              <Label htmlFor="very-dissatisfied" className="cursor-pointer">
                Very Dissatisfied
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Comments */}
        <div className="space-y-2">
          <Label htmlFor="comments" className="text-base">
            Additional Comments (Optional)
          </Label>
          <Textarea
            id="comments"
            placeholder="What did you like? What could be improved?"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
          />
        </div>

        {/* Quick Feedback Options */}
        <div>
          <Label className="text-base mb-2 block">Quick Feedback</Label>
          <div className="flex flex-wrap gap-2">
            {[
              'Colors are perfect',
              'Layout is cleaner',
              'More professional',
              'Easy to read',
              'Love the design',
              'Needs more contrast',
              'Too many changes',
              'Lost some content',
            ].map((option) => (
              <Button
                key={option}
                variant="outline"
                size="sm"
                onClick={() => setComments((prev) => prev + (prev ? ', ' : '') + option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full"
        >
          {submitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Submit Feedback
        </Button>
      </CardContent>
    </Card>
  )
}