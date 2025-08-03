'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Bug, Lightbulb, Zap, MessageCircle, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'general';
type Position = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface BetaFeedbackWidgetProps {
  position?: Position;
  userId?: string;
}

const feedbackTypes = [
  { value: 'bug', label: 'Bug Report', icon: Bug },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb },
  { value: 'improvement', label: 'Improvement', icon: Zap },
  { value: 'general', label: 'General Feedback', icon: MessageCircle },
] as const;

const positionClasses: Record<Position, string> = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
};

export function BetaFeedbackWidget({ position = 'bottom-right', userId }: BetaFeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isBetaUser, setIsBetaUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const { toast } = useToast();

  // Check if user is a beta user
  useEffect(() => {
    const checkBetaStatus = async () => {
      if (!userId) return;
      
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('user_profiles')
          .select('is_beta_user')
          .eq('id', userId)
          .single();
        
        if (!error && data) {
          setIsBetaUser(data.is_beta_user || false);
        }
      } catch (error) {
        console.error('Error checking beta status:', error);
      }
    };

    checkBetaStatus();
  }, [userId]);

  // Don't render if not a beta user
  if (!isBetaUser) return null;

  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    const browserInfo = {
      userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    };
    return browserInfo;
  };

  const handleScreenshotCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setScreenshot(file);
    } else {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: 'Message required',
        description: 'Please enter your feedback message',
        variant: 'destructive',
      });
      return;
    }

    // Title is required for API
    const title = message.slice(0, 50) + (message.length > 50 ? '...' : '');

    setIsSubmitting(true);
    
    try {
      const browserInfo = getBrowserInfo();
      
      // Upload screenshot if provided
      let attachments: Array<{ url: string; type: string; size: number }> = [];
      if (screenshot) {
        const fileExt = screenshot.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        
        const supabase = createClient();
        const { data: _uploadData, error: uploadError } = await supabase.storage
          .from('feedback-screenshots')
          .upload(fileName, screenshot);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('feedback-screenshots')
          .getPublicUrl(fileName);
        
        attachments = [{
          url: publicUrl,
          type: screenshot.type,
          size: screenshot.size,
        }];
      }
      
      // Submit feedback via API
      const response = await fetch('/api/v1/beta/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: feedbackType,
          rating: rating || undefined,
          title,
          description: message,
          page_url: window.location.href,
          browser_info: browserInfo,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to submit feedback');
      }
      
      toast({
        title: 'Feedback submitted!',
        description: 'Thank you for helping us improve BeautifyAI',
      });
      
      // Reset form
      setMessage('');
      setRating(0);
      setScreenshot(null);
      setFeedbackType('general');
      setIsOpen(false);
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

  const StarRating = () => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className={cn(
              'text-2xl transition-colors',
              star <= rating ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-300'
            )}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Floating Button */}
      <div
        className={cn(
          'fixed z-50 transition-all duration-300',
          positionClasses[position],
          isMinimized && 'opacity-50 hover:opacity-100'
        )}
      >
        <div className="flex items-center gap-2">
          {!isMinimized && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
              Beta
            </span>
          )}
          <Button
            onClick={() => setIsOpen(true)}
            size="icon"
            className="rounded-full shadow-lg hover:shadow-xl transition-shadow"
            title="Send feedback"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button
            onClick={() => setIsMinimized(!isMinimized)}
            size="icon"
            variant="ghost"
            className="rounded-full h-6 w-6"
            title={isMinimized ? 'Show beta label' : 'Hide beta label'}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Beta Feedback</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Feedback Type */}
            <div className="space-y-2">
              <Label>Feedback Type</Label>
              <RadioGroup value={feedbackType} onValueChange={(value) => setFeedbackType(value as FeedbackType)}>
                <div className="grid grid-cols-2 gap-3">
                  {feedbackTypes.map(({ value, label, icon: Icon }) => (
                    <div key={value}>
                      <RadioGroupItem
                        value={value}
                        id={value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={value}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors',
                          'hover:bg-accent',
                          'peer-checked:border-primary peer-checked:bg-primary/10'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Rating */}
            <div className="space-y-2">
              <Label>How would you rate your experience?</Label>
              <StarRating />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Your Feedback</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Screenshot */}
            <div className="space-y-2">
              <Label>Attach Screenshot (optional)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {screenshot ? 'Change Screenshot' : 'Upload Screenshot'}
                </Button>
                {screenshot && (
                  <span className="text-sm text-muted-foreground">
                    {screenshot.name}
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleScreenshotCapture}
                className="hidden"
              />
            </div>

            {/* Page Info */}
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <p>Page: {pathname}</p>
              <p>Browser: {navigator.userAgent.split(' ').slice(-2).join(' ')}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}