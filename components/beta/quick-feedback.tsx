'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  Zap, 
  Send,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickFeedbackProps {
  userId: string;
}

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'general';

const feedbackTypes = [
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-red-600', bgColor: 'bg-red-100' },
  { value: 'feature', label: 'Feature', icon: Lightbulb, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { value: 'improvement', label: 'Improvement', icon: Zap, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { value: 'general', label: 'General', icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-100' },
] as const;

export function QuickFeedback({ userId: _userId }: QuickFeedbackProps) {
  const [selectedType, setSelectedType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: 'Message required',
        description: 'Please enter your feedback message',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');
      
      const response = await fetch('/api/v1/beta/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedType,
          title,
          description: message,
          page_url: window.location.href,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to submit feedback');
      }
      
      toast({
        title: 'Feedback submitted!',
        description: 'Thank you for your contribution to BeautifyAI',
      });
      
      // Reset form
      setMessage('');
      setSelectedType('general');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Submission failed',
        description: error instanceof Error ? error.message : 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Feedback</CardTitle>
        <CardDescription>Share your thoughts, report bugs, or suggest features</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Feedback Type Selection */}
        <div className="grid grid-cols-4 gap-2">
          {feedbackTypes.map(({ value, label, icon: Icon, color, bgColor }) => (
            <button
              key={value}
              onClick={() => setSelectedType(value)}
              className={cn(
                'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all',
                'hover:shadow-sm',
                selectedType === value 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className={cn('p-2 rounded-lg', bgColor)}>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Feedback Message */}
        <div className="space-y-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              selectedType === 'bug' 
                ? "Describe the bug you encountered..."
                : selectedType === 'feature'
                ? "What feature would you like to see?"
                : selectedType === 'improvement'
                ? "How can we improve this?"
                : "Share your feedback..."
            }
            rows={4}
            className="resize-none"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {message.length}/500 characters
            </p>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim() || message.length > 500}
              size="sm"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Feedback Tips */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <p className="text-xs font-medium">Feedback Tips:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
            <li>Be specific and provide context</li>
            <li>Include steps to reproduce bugs</li>
            <li>Explain how features would benefit users</li>
            <li>Screenshots can be added via the feedback widget</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}