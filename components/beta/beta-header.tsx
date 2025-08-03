'use client';

import { useAuth } from '@/contexts/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  MessageSquare, 
  Users, 
  TrendingUp,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export function BetaHeader() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      {/* Back to main dashboard */}
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Beta Dashboard</h1>
            <Badge variant="default" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Beta Tester
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Welcome back, {user?.user_metadata?.full_name || 'Beta Tester'}! Thank you for helping us improve BeautifyAI.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/beta/guidelines">
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Beta Guidelines
            </Button>
          </Link>
          <Link href="/beta/leaderboard">
            <Button variant="outline" size="sm">
              <TrendingUp className="h-4 w-4 mr-2" />
              Leaderboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Beta Program Info Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">Your feedback shapes the future of BeautifyAI</p>
            <p className="text-sm text-muted-foreground">
              As a beta tester, you get early access to new features, unlimited enhancements during beta, 
              and direct influence on our product roadmap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}