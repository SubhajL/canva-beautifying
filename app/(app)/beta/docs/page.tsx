'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Book, 
  Rocket, 
  Users, 
  MessageSquare, 
  Bug, 
  Lightbulb,
  Shield,
  Zap,
  Trophy,
  Mail,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

const sections = {
  overview: {
    title: 'Beta Program Overview',
    icon: Rocket,
  },
  guidelines: {
    title: 'Guidelines & Expectations',
    icon: Book,
  },
  features: {
    title: 'Beta Features',
    icon: Zap,
  },
  feedback: {
    title: 'Providing Feedback',
    icon: MessageSquare,
  },
  faq: {
    title: 'FAQ',
    icon: AlertCircle,
  },
};

export default function BetaDocumentation() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Beta Program Documentation</h1>
        <p className="text-muted-foreground">
          Everything you need to know about the BeautifyAI Beta Program
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full">
          {Object.entries(sections).map(([key, section]) => (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm">
              <section.icon className="h-4 w-4 mr-1 hidden sm:inline" />
              <span className="truncate">{section.title.split(' ')[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Welcome to the Beta Program
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Thank you for joining the BeautifyAI Beta Program! As a beta tester, you&apos;re helping us
                shape the future of AI-powered document enhancement. Your feedback and insights are
                invaluable in creating the best possible experience for all users.
              </p>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Beta features are pre-release and may contain bugs or incomplete functionality.
                  Your data is always secure, but please keep backups of important documents.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Your Benefits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Early access to new features</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Priority processing queue</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Direct influence on product development</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        <span>Exclusive beta community access</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">What We Need</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-blue-500 mt-0.5" />
                        <span>Regular feedback on your experience</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Bug className="h-4 w-4 text-orange-500 mt-0.5" />
                        <span>Bug reports with detailed information</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5" />
                        <span>Feature suggestions and ideas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Users className="h-4 w-4 text-purple-500 mt-0.5" />
                        <span>Share your use cases with us</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Beta Ranks & Recognition
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Your contributions are recognized through our ranking system. The more you engage,
                the higher your rank!
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="font-medium">Rookie</span>
                  <span className="text-sm text-muted-foreground">0-50 points</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="font-medium">Contributor</span>
                  <span className="text-sm text-muted-foreground">51-150 points</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="font-medium">Expert</span>
                  <span className="text-sm text-muted-foreground">151-300 points</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="font-medium">Champion</span>
                  <span className="text-sm text-muted-foreground">301-500 points</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="font-medium">Legend</span>
                  <span className="text-sm text-muted-foreground">500+ points</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guidelines" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Book className="h-5 w-5" />
                Community Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">1. Confidentiality</h4>
                <p className="text-sm text-muted-foreground">
                  Beta features are confidential. Please don&apos;t share screenshots, details, or
                  experiences outside the beta community until features are publicly released.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">2. Constructive Feedback</h4>
                <p className="text-sm text-muted-foreground">
                  We value honest feedback, but please keep it constructive. Focus on what works,
                  what doesn&apos;t, and how things could be improved.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">3. Active Participation</h4>
                <p className="text-sm text-muted-foreground">
                  Try to use beta features regularly and provide feedback at least once a week.
                  Your consistent input helps us iterate quickly.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">4. Report Issues Promptly</h4>
                <p className="text-sm text-muted-foreground">
                  If you encounter bugs or issues, report them as soon as possible with as much
                  detail as you can provide.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">5. Respect Privacy</h4>
                <p className="text-sm text-muted-foreground">
                  Don&apos;t share other beta users&apos; feedback or information. Respect everyone&apos;s
                  privacy and contributions.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Badge className="mt-0.5">DO</Badge>
                  <span className="text-sm">Test features thoroughly in different scenarios</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="mt-0.5">DO</Badge>
                  <span className="text-sm">Include steps to reproduce when reporting bugs</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge className="mt-0.5">DO</Badge>
                  <span className="text-sm">Suggest improvements based on your workflow</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="destructive" className="mt-0.5">DON&apos;T</Badge>
                  <span className="text-sm">Use beta features for critical production work</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="destructive" className="mt-0.5">DON&apos;T</Badge>
                  <span className="text-sm">Share beta access with non-beta users</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Currently Available Beta Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">Batch Processing</h4>
                    <Badge variant="secondary">Beta</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Process multiple documents simultaneously with our new batch enhancement engine.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: Testing performance optimizations
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">Advanced AI Models</h4>
                    <Badge variant="secondary">Beta</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Access to GPT-4 and Claude 3 for enhanced document analysis and generation.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: Gathering feedback on quality improvements
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">Custom Templates</h4>
                    <Badge variant="secondary">Beta</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Create and save your own enhancement templates for consistent styling.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: Adding more customization options
                  </p>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">Priority Queue</h4>
                    <Badge variant="secondary">Beta</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Skip the line with priority processing for all your enhancements.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: Monitoring queue performance
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  Real-time collaboration features
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  API access for developers
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  Advanced analytics dashboard
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  White-label customization options
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                How to Provide Effective Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Bug Reports
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  When reporting bugs, include:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                  <li>What you were trying to do</li>
                  <li>What actually happened</li>
                  <li>Steps to reproduce the issue</li>
                  <li>Browser and OS information</li>
                  <li>Screenshots if applicable</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Feature Requests
                </h4>
                <p className="text-sm text-muted-foreground mb-2">
                  When suggesting features:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                  <li>Describe the problem you&apos;re trying to solve</li>
                  <li>Explain your proposed solution</li>
                  <li>Share how it would improve your workflow</li>
                  <li>Include examples or mockups if possible</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  General Feedback
                </h4>
                <p className="text-sm text-muted-foreground">
                  Share your overall experience, what you love, what frustrates you, and any
                  ideas for improvement. No feedback is too small!
                </p>
              </div>

              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>
                  Use the floating feedback widget (bottom right) for quick feedback, or visit
                  your <Link href="/beta/dashboard" className="font-medium underline">beta dashboard</Link> for
                  more options.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-2">How long does the beta program last?</h4>
                <p className="text-sm text-muted-foreground">
                  The beta program typically runs for 3-6 months, depending on feature complexity
                  and feedback. You&apos;ll be notified before any features graduate to general availability.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Will I lose access when beta ends?</h4>
                <p className="text-sm text-muted-foreground">
                  No! Beta users often receive special perks when features launch publicly, including
                  discounted pricing or extended access periods.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Can I invite others to the beta program?</h4>
                <p className="text-sm text-muted-foreground">
                  We occasionally open referral programs for high-contributing beta users. Check your
                  beta dashboard for invitation opportunities.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">What happens to my beta feedback?</h4>
                <p className="text-sm text-muted-foreground">
                  Every piece of feedback is reviewed by our product team. You&apos;ll see status updates
                  in your feedback history, and we&apos;ll notify you when your suggestions are implemented.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Are beta features stable?</h4>
                <p className="text-sm text-muted-foreground">
                  Beta features are generally stable but may have bugs or incomplete functionality.
                  We recommend keeping backups of important documents and not relying solely on
                  beta features for critical work.
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">How do I report urgent issues?</h4>
                <p className="text-sm text-muted-foreground">
                  For critical bugs or security issues, use the feedback widget and mark your report
                  as &ldquo;Critical&rdquo;. These are prioritized and addressed immediately.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need More Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link 
                href="/beta/dashboard" 
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Visit your Beta Dashboard
              </Link>
              <Link 
                href="/support" 
                className="flex items-center gap-2 text-sm hover:underline"
              >
                <Mail className="h-4 w-4" />
                Contact Beta Support
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}