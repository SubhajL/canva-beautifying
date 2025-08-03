'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  TestTube, 
  MessageSquare, 
  Zap, 
  Shield, 
  ArrowRight,
  CheckCircle2,
  Users,
  Gift
} from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface BetaOnboardingProps {
  open: boolean;
  onComplete: () => void;
}

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to the Beta Program!',
    icon: Sparkles,
    content: 'You\'re among the first to experience BeautifyAI\'s powerful document enhancement features.',
  },
  {
    id: 'benefits',
    title: 'Beta Member Benefits',
    icon: Gift,
    benefits: [
      { icon: Zap, text: 'Early access to new features' },
      { icon: Shield, text: 'Priority support and processing' },
      { icon: Users, text: 'Direct influence on product development' },
      { icon: MessageSquare, text: 'Exclusive beta community access' },
    ],
  },
  {
    id: 'expectations',
    title: 'What We Need From You',
    icon: TestTube,
    expectations: [
      'Provide feedback on your experience',
      'Report any bugs or issues you encounter',
      'Share feature suggestions and ideas',
      'Help us understand your use cases',
    ],
  },
  {
    id: 'consent',
    title: 'Beta Program Agreement',
    icon: Shield,
    consent: true,
  },
];

export function BetaOnboarding({ open, onComplete }: BetaOnboardingProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [consents, setConsents] = useState({
    feedback: false,
    analytics: false,
    communication: false,
  });
  const [isCompleting, setIsCompleting] = useState(false);

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    // Validate consents
    if (!consents.feedback || !consents.analytics) {
      toast.error('Please accept the required agreements to continue');
      return;
    }

    setIsCompleting(true);

    try {
      const supabase = createClient();
      
      // Update user profile with beta onboarding completion
      const { error } = await supabase
        .from('user_profiles')
        .update({
          beta_onboarding_completed: true,
          beta_consents: consents,
          beta_onboarding_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Track onboarding completion
      await supabase.from('beta_analytics').insert({
        user_id: user.id,
        event_type: 'beta_onboarding_completed',
        event_category: 'onboarding',
        metadata: { consents },
      });

      toast.success('Welcome to the BeautifyAI Beta Program!');
      onComplete();
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Failed to complete onboarding. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <step.icon className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {step.content}
              </p>
            </div>
            <Badge variant="secondary" className="text-lg py-1 px-3">
              Beta User #{String(user?.id).slice(-4) || '0001'}
            </Badge>
          </div>
        );

      case 'benefits':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-semibold">{step.title}</h3>
            </div>
            <div className="grid gap-4">
              {step.benefits?.map((benefit, index) => (
                <Card key={index} className="border-muted">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm">{benefit.text}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'expectations':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground">
                Your feedback helps us build a better product for everyone
              </p>
            </div>
            <div className="space-y-3">
              {step.expectations?.map((expectation, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{expectation}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'consent':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground">
                Please review and accept our beta program terms
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="feedback"
                  checked={consents.feedback}
                  onCheckedChange={(checked) =>
                    setConsents({ ...consents, feedback: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="feedback" className="text-sm font-medium cursor-pointer">
                    Feedback Collection (Required)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    I agree to provide feedback and allow BeautifyAI to collect usage feedback
                    to improve the product.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="analytics"
                  checked={consents.analytics}
                  onCheckedChange={(checked) =>
                    setConsents({ ...consents, analytics: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="analytics" className="text-sm font-medium cursor-pointer">
                    Usage Analytics (Required)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    I agree to share anonymous usage data to help improve the product experience.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="communication"
                  checked={consents.communication}
                  onCheckedChange={(checked) =>
                    setConsents({ ...consents, communication: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="communication" className="text-sm font-medium cursor-pointer">
                    Beta Communications (Optional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    I&apos;d like to receive updates about new features and beta program news.
                  </p>
                </div>
              </div>
            </div>

            <Card className="bg-muted/50 border-muted">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  By joining the beta program, you acknowledge that you&apos;re using pre-release
                  software that may contain bugs. Your data is secure and will be handled
                  according to our privacy policy.
                </p>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Beta Program Onboarding
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Content */}
          <div className="min-h-[300px] flex items-center justify-center">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={
                isCompleting ||
                (currentStep === steps.length - 1 && (!consents.feedback || !consents.analytics))
              }
            >
              {isCompleting ? (
                'Completing...'
              ) : currentStep === steps.length - 1 ? (
                'Complete Onboarding'
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}