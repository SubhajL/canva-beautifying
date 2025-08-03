'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  Users,
  Zap,
  Shield,
  Star,
  CheckCircle2,
  ArrowRight,
  Clock,
  Gift,
  MessageSquare,
  Mail,
  Calendar,
} from 'lucide-react';

export default function BetaProgramPage() {
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // TODO: Implement actual submission logic
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setSubmitStatus('success');
    setIsSubmitting(false);
    setEmail('');
    setInviteCode('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute right-1/4 bottom-0 translate-x-1/2 translate-y-1/2 h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-3xl" />
        </div>
        
        <div className="mx-auto max-w-7xl text-center">
          <Badge variant="outline" className="mb-4 px-4 py-1">
            <Sparkles className="mr-2 h-3 w-3" />
            Beta Program Now Open
          </Badge>
          
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Be Among the First to
            <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent"> Transform </span>
            Your Documents with AI
          </h1>
          
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Join our exclusive beta program and get early access to revolutionary AI-powered document enhancement. 
            Help shape the future of visual content while enjoying premium features for free.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="group" onClick={() => document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' })}>
              Join the Beta Program
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#benefits">Learn More</Link>
            </Button>
          </div>
          
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Limited to 500 beta users</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>3-month exclusive access</span>
            </div>
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              <span>Free premium features</span>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why Join Our Beta Program?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Be part of an exclusive group shaping the future of document enhancement
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Early Access</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Get exclusive access to cutting-edge AI features before anyone else. 
                  Be the first to experience the future of document enhancement.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                  <Gift className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>Free Premium Features</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Enjoy all premium features at no cost during the beta period. 
                  Plus, get lifetime discounts when we launch.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Shape the Product</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Your feedback directly influences our development. 
                  Have a real impact on features and functionality.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* What Beta Users Get */}
      <section className="bg-muted/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Exclusive Beta User Benefits
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                As a beta tester, you&apos;ll receive access to features typically reserved for our highest tier subscribers.
              </p>
              
              <div className="mt-8 space-y-4">
                {[
                  'Unlimited document enhancements',
                  'Access to all AI models (GPT-4, Claude, Gemini)',
                  'Priority processing queue',
                  'Advanced export options',
                  'Direct support channel with our team',
                  'Lifetime 50% discount after beta',
                  'Beta tester badge on your profile',
                  'Early access to new features',
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-600/20" />
                <CardHeader className="relative">
                  <Badge className="w-fit mb-4">BETA EXCLUSIVE</Badge>
                  <CardTitle className="text-2xl">Premium Plus Access</CardTitle>
                  <CardDescription className="text-base">
                    Worth $99/month - Free for beta testers
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative space-y-6">
                  <div>
                    <p className="text-sm font-medium mb-2">AI Models</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">GPT-4o</Badge>
                      <Badge variant="secondary">Claude 3</Badge>
                      <Badge variant="secondary">Gemini Pro</Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Monthly Limits</p>
                    <p className="text-2xl font-bold">Unlimited</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Support</p>
                    <p className="text-muted-foreground">Priority + Direct Team Access</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            What Early Testers Are Saying
          </h2>
          
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'Sarah Chen',
                role: 'Marketing Director',
                content: 'The AI suggestions transformed our presentations completely. Can\'t wait for the full launch!',
                rating: 5,
              },
              {
                name: 'Michael Rodriguez',
                role: 'Teacher',
                content: 'This tool saves me hours on creating engaging worksheets. My students love the enhanced visuals.',
                rating: 5,
              },
              {
                name: 'Emma Thompson',
                role: 'Startup Founder',
                content: 'Game-changer for our pitch decks. The AI understands design principles better than most designers.',
                rating: 5,
              },
            ].map((testimonial, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex gap-1 mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    ))}
                  </div>
                  <CardTitle className="text-lg">{testimonial.name}</CardTitle>
                  <CardDescription>{testimonial.role}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground italic">&ldquo;{testimonial.content}&rdquo;</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Beta Timeline */}
      <section className="bg-muted/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Beta Program Timeline
          </h2>
          <p className="mt-4 text-center text-lg text-muted-foreground">
            Join us on this exciting journey
          </p>
          
          <div className="mt-16 max-w-3xl mx-auto">
            <div className="space-y-8">
              {[
                {
                  date: 'January 2024',
                  title: 'Beta Launch',
                  description: 'Open registration for first 500 beta testers',
                  status: 'current',
                },
                {
                  date: 'February 2024',
                  title: 'Feature Expansion',
                  description: 'Roll out advanced AI models and batch processing',
                  status: 'upcoming',
                },
                {
                  date: 'March 2024',
                  title: 'Community Feedback',
                  description: 'Implement top requested features from beta testers',
                  status: 'upcoming',
                },
                {
                  date: 'April 2024',
                  title: 'Public Launch',
                  description: 'Full platform launch with beta tester benefits locked in',
                  status: 'upcoming',
                },
              ].map((item, index) => (
                <div key={index} className="relative flex gap-6">
                  <div className="relative flex flex-col items-center">
                    <div className={`h-12 w-12 rounded-full border-4 ${
                      item.status === 'current' 
                        ? 'border-primary bg-primary text-primary-foreground' 
                        : 'border-muted-foreground/20 bg-background'
                    } flex items-center justify-center`}>
                      <Calendar className="h-5 w-5" />
                    </div>
                    {index < 3 && (
                      <div className="absolute top-12 h-full w-0.5 bg-muted-foreground/20" />
                    )}
                  </div>
                  <div className="pb-8">
                    <p className="text-sm text-muted-foreground">{item.date}</p>
                    <h3 className="mt-1 text-xl font-semibold">{item.title}</h3>
                    <p className="mt-2 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently Asked Questions
          </h2>
          
          <Accordion type="single" collapsible className="mt-12">
            <AccordionItem value="item-1">
              <AccordionTrigger>What is included in the beta program?</AccordionTrigger>
              <AccordionContent>
                Beta testers get full access to all premium features including unlimited enhancements, 
                all AI models, priority processing, and direct support. You&apos;ll also receive a lifetime 
                50% discount when we officially launch.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2">
              <AccordionTrigger>How long does the beta program last?</AccordionTrigger>
              <AccordionContent>
                The beta program runs for 3 months from January to April 2024. After that, you&apos;ll 
                automatically transition to a discounted premium plan with all your beta benefits preserved.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger>Do I need an invitation code?</AccordionTrigger>
              <AccordionContent>
                Yes, invitation codes are being distributed to ensure quality feedback. You can request 
                one by joining our waitlist, or if you have a code from our team or another beta tester, 
                you can use it to join immediately.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4">
              <AccordionTrigger>What are my responsibilities as a beta tester?</AccordionTrigger>
              <AccordionContent>
                We ask that you actively use the platform and provide feedback through our built-in 
                feedback system. Monthly surveys are optional but appreciated. There&apos;s no minimum 
                usage requirement - use it as much or as little as fits your needs.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5">
              <AccordionTrigger>Will my data be safe during the beta?</AccordionTrigger>
              <AccordionContent>
                Absolutely. We use enterprise-grade encryption and security measures. Your documents 
                are stored securely on Cloudflare R2 and are only accessible by you. We never train 
                our AI models on user data.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-6">
              <AccordionTrigger>Can I invite others to the beta program?</AccordionTrigger>
              <AccordionContent>
                Yes! Each beta tester receives 3 invitation codes to share with colleagues or friends. 
                This helps us build a diverse testing community while keeping the program exclusive.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Sign-up Form */}
      <section id="signup-form" className="bg-muted/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Join the Beta Program</CardTitle>
              <CardDescription>
                Enter your invitation code or join the waitlist
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="invite-code">
                    Invitation Code
                    <span className="ml-2 text-sm text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="invite-code"
                    type="text"
                    placeholder="BETA-XXXX-XXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Don&apos;t have a code? You&apos;ll be added to our waitlist.
                  </p>
                </div>
                
                {submitStatus === 'success' && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      {inviteCode 
                        ? "Welcome to the beta program! Check your email for next steps."
                        : "You've been added to our waitlist. We'll notify you when a spot opens up!"}
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : inviteCode ? 'Join Beta Program' : 'Join Waitlist'}
                </Button>
                
                <p className="text-center text-sm text-muted-foreground">
                  By joining, you agree to our{' '}
                  <Link href="/terms" className="underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="underline">Privacy Policy</Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Have Questions?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our team is here to help you get started
          </p>
          
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
            <Card>
              <CardHeader>
                <Mail className="h-8 w-8 mx-auto mb-2 text-primary" />
                <CardTitle className="text-lg">Email Support</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">beta@example.com</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-primary" />
                <CardTitle className="text-lg">Discord Community</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Join our Discord</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
                <CardTitle className="text-lg">Documentation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">docs.example.com</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}