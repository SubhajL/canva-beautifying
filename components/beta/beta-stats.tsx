'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  Zap, 
  FileCheck,
  Calendar,
  Trophy,
  TrendingUp
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface BetaStatsProps {
  userId: string;
}

interface Stats {
  feedbackSubmitted: number;
  bugsReported: number;
  featuresRequested: number;
  improvementsSuggested: number;
  documentsEnhanced: number;
  daysSinceBetaJoined: number;
  feedbackResolved: number;
  contributionScore: number;
}

export function BetaStats({ userId }: BetaStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const supabase = createClient();
        
        // Fetch user's beta join date
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('beta_joined_at')
          .eq('id', userId)
          .single();

        const betaJoinedAt = profile?.beta_joined_at ? new Date(profile.beta_joined_at) : new Date();
        const daysSinceBetaJoined = Math.floor((new Date().getTime() - betaJoinedAt.getTime()) / (1000 * 60 * 60 * 24));

        // Fetch feedback statistics
        const { data: feedback } = await supabase
          .from('beta_feedback')
          .select('feedback_type, status')
          .eq('user_id', userId);

        const feedbackStats = feedback?.reduce((acc, item) => {
          acc.total++;
          if (item.feedback_type === 'bug') acc.bugs++;
          if (item.feedback_type === 'feature') acc.features++;
          if (item.feedback_type === 'improvement') acc.improvements++;
          if (item.status === 'resolved') acc.resolved++;
          return acc;
        }, { total: 0, bugs: 0, features: 0, improvements: 0, resolved: 0 }) || 
        { total: 0, bugs: 0, features: 0, improvements: 0, resolved: 0 };

        // Fetch enhancement count
        const { count: enhancementCount } = await supabase
          .from('enhancements')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'completed');

        // Calculate contribution score
        const contributionScore = 
          feedbackStats.total * 10 + 
          feedbackStats.bugs * 5 + 
          feedbackStats.features * 3 + 
          feedbackStats.resolved * 15 +
          (enhancementCount || 0) * 2;

        setStats({
          feedbackSubmitted: feedbackStats.total,
          bugsReported: feedbackStats.bugs,
          featuresRequested: feedbackStats.features,
          improvementsSuggested: feedbackStats.improvements,
          documentsEnhanced: enhancementCount || 0,
          daysSinceBetaJoined,
          feedbackResolved: feedbackStats.resolved,
          contributionScore
        });
      } catch (error) {
        console.error('Error fetching beta stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Beta Contribution</CardTitle>
          <CardDescription>Track your impact on BeautifyAI development</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const statItems = [
    {
      label: 'Total Feedback',
      value: stats?.feedbackSubmitted || 0,
      icon: MessageSquare,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Bugs Reported',
      value: stats?.bugsReported || 0,
      icon: Bug,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      label: 'Features Requested',
      value: stats?.featuresRequested || 0,
      icon: Lightbulb,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      label: 'Improvements',
      value: stats?.improvementsSuggested || 0,
      icon: Zap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      label: 'Documents Enhanced',
      value: stats?.documentsEnhanced || 0,
      icon: FileCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      label: 'Days in Beta',
      value: stats?.daysSinceBetaJoined || 0,
      icon: Calendar,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
    {
      label: 'Resolved Feedback',
      value: stats?.feedbackResolved || 0,
      icon: Trophy,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      label: 'Contribution Score',
      value: stats?.contributionScore || 0,
      icon: TrendingUp,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Beta Contribution</CardTitle>
        <CardDescription>Track your impact on BeautifyAI development</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statItems.map((stat) => (
            <div
              key={stat.label}
              className="bg-background border rounded-lg p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}