import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Textarea } from "./textarea"
import { RadioGroup, RadioGroupItem } from "./radio-group"
import { Label } from "./label"
import { Star, ThumbsUp, ThumbsDown } from "lucide-react"

interface FeedbackFormProps extends Omit<React.HTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  onSubmit?: (data: FeedbackData) => void
  variant?: "simple" | "detailed"
}

interface FeedbackData {
  rating?: number
  satisfaction?: "positive" | "negative"
  category?: string
  comment: string
}

const FeedbackForm = React.forwardRef<HTMLFormElement, FeedbackFormProps>(
  ({ className, onSubmit, variant = "simple", ...props }, ref) => {
    const [rating, setRating] = React.useState<number>(0)
    const [hoveredRating, setHoveredRating] = React.useState<number>(0)
    const [satisfaction, setSatisfaction] = React.useState<"positive" | "negative" | null>(null)
    const [category, setCategory] = React.useState<string>("")
    const [comment, setComment] = React.useState<string>("")
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (onSubmit) {
        onSubmit({
          rating: variant === "detailed" ? rating : undefined,
          satisfaction: variant === "simple" ? satisfaction || undefined : undefined,
          category: variant === "detailed" ? category : undefined,
          comment,
        })
      }
    }
    
    const categories = [
      { value: "enhancement", label: "Enhancement Quality" },
      { value: "speed", label: "Processing Speed" },
      { value: "ui", label: "User Interface" },
      { value: "features", label: "Features" },
      { value: "other", label: "Other" },
    ]
    
    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className={cn("space-y-6", className)}
        {...props}
      >
        {variant === "simple" ? (
          <>
            <div className="space-y-3">
              <Label className="text-base">How was your experience?</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={satisfaction === "positive" ? "default" : "outline"}
                  size="lg"
                  className="flex-1"
                  onClick={() => setSatisfaction("positive")}
                >
                  <ThumbsUp className="mr-2 h-5 w-5" />
                  Good
                </Button>
                <Button
                  type="button"
                  variant={satisfaction === "negative" ? "default" : "outline"}
                  size="lg"
                  className="flex-1"
                  onClick={() => setSatisfaction("negative")}
                >
                  <ThumbsDown className="mr-2 h-5 w-5" />
                  Could be better
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <Label className="text-base">Rate your experience</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHoveredRating(value)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="transition-transform hover:scale-110 focus:outline-none focus:scale-110"
                  >
                    <Star
                      className={cn(
                        "h-8 w-8 transition-colors",
                        (hoveredRating || rating) >= value
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <Label className="text-base">What would you like to tell us about?</Label>
              <RadioGroup value={category} onValueChange={setCategory}>
                {categories.map((cat) => (
                  <div key={cat.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={cat.value} id={cat.value} />
                    <Label htmlFor={cat.value} className="font-normal cursor-pointer">
                      {cat.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </>
        )}
        
        <div className="space-y-3">
          <Label htmlFor="comment" className="text-base">
            {variant === "simple" ? "Tell us more (optional)" : "Your feedback"}
          </Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your thoughts..."
            rows={4}
            required={variant === "detailed"}
          />
        </div>
        
        <Button
          type="submit"
          className="w-full"
          disabled={
            variant === "simple" 
              ? !satisfaction && !comment
              : !rating || !category || !comment
          }
        >
          Submit Feedback
        </Button>
      </form>
    )
  }
)
FeedbackForm.displayName = "FeedbackForm"

export { FeedbackForm, type FeedbackData }