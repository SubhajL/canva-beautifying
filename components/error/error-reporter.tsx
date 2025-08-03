'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bug, Send } from 'lucide-react';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';

interface ErrorReporterProps {
  errorId?: string | null;
  errorMessage?: string;
  trigger?: React.ReactNode;
}

export function ErrorReporter({ 
  errorId, 
  errorMessage,
  trigger 
}: ErrorReporterProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    steps: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Send user feedback to Sentry
      const feedbackId = Sentry.captureMessage('User Error Report', {
        level: 'info',
        tags: {
          type: 'user_feedback',
          errorId: errorId || 'unknown',
        },
        extra: {
          ...formData,
          originalError: errorMessage,
          timestamp: new Date().toISOString(),
        },
      });

      // Here you would typically send this to your API
      // For now, we'll just log it
      console.log('Error report submitted:', {
        errorId,
        feedbackId,
        ...formData,
      });

      toast.success('Thank you for your report!', {
        description: 'Our team will investigate the issue.',
      });

      setOpen(false);
      setFormData({ description: '', steps: '', email: '' });
    } catch (_error) {
      toast.error('Failed to submit report', {
        description: 'Please try again later.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Bug className="mr-2 h-4 w-4" />
            Report Issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
          <DialogDescription>
            Help us improve by describing what went wrong.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorId && (
            <div className="text-sm">
              <Label className="text-muted-foreground">Error ID</Label>
              <p className="font-mono text-xs">{errorId}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="description">What happened?</Label>
            <Textarea
              id="description"
              required
              placeholder="Describe the issue you encountered..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                description: e.target.value 
              }))}
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="steps">Steps to reproduce (optional)</Label>
            <Textarea
              id="steps"
              placeholder="1. Clicked on upload button&#10;2. Selected a PDF file&#10;3. Error appeared"
              value={formData.steps}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                steps: e.target.value 
              }))}
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                email: e.target.value 
              }))}
            />
            <p className="text-xs text-muted-foreground">
              We&apos;ll only use this to follow up on your report
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                'Sending...'
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Report
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}