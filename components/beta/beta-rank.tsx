'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/client';
import { 
  Trophy,
  Medal,
  Award,
  Star,
  Target,
  Zap
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface BetaRankProps {
  userId: string;
}

interface RankData {
  rank: string;
  level: number;
  score: number;
  nextLevelScore: number;
  percentageToNext: number;
  badges: Badge[];
  globalRank?: number;
  totalBetaUsers?: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  earned: boolean;
  earnedAt?: string;
}

const RANK_LEVELS = [
  { level: 1, name: 'Beta Rookie', minScore: 0, icon: Star },
  { level: 2, name: 'Beta Explorer', minScore: 100, icon: Target },
  { level: 3, name: 'Beta Contributor', minScore: 300, icon: Medal },
  { level: 4, name: 'Beta Champion', minScore: 600, icon: Trophy },
  { level: 5, name: 'Beta Legend', minScore: 1000, icon: Award },
];

const BADGES = [
  {
    id: 'first_feedback',
    name: 'First Steps',
    description: 'Submitted your first feedback',
    threshold: { feedbackCount: 1 },
  },
  {
    id: 'bug_hunter',
    name: 'Bug Hunter',
    description: 'Reported 5 bugs',
    threshold: { bugCount: 5 },
  },
  {
    id: 'idea_generator',
    name: 'Idea Generator',
    description: 'Suggested 10 features',
    threshold: { featureCount: 10 },
  },
  {
    id: 'power_user',
    name: 'Power User',
    description: 'Enhanced 50 documents',
    threshold: { enhancementCount: 50 },
  },
  {
    id: 'veteran',
    name: 'Beta Veteran',
    description: '30 days in beta program',
    threshold: { daysInBeta: 30 },
  },
  {
    id: 'feedback_master',
    name: 'Feedback Master',
    description: '25 feedback submissions',
    threshold: { feedbackCount: 25 },
  },
];

export function BetaRank({ userId }: BetaRankProps) {
  const [rankData, setRankData] = useState<RankData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRankData = async () => {
      try {
        const supabase = createClient();
        
        // Fetch user stats
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('beta_joined_at')
          .eq('id', userId)
          .single();

        const betaJoinedAt = profile?.beta_joined_at ? new Date(profile.beta_joined_at) : new Date();
        const daysInBeta = Math.floor((new Date().getTime() - betaJoinedAt.getTime()) / (1000 * 60 * 60 * 24));

        // Fetch feedback stats
        const { data: feedback } = await supabase
          .from('beta_feedback')
          .select('feedback_type')
          .eq('user_id', userId);

        const feedbackStats = feedback?.reduce((acc, item) => {
          acc.total++;
          if (item.feedback_type === 'bug') acc.bugs++;
          if (item.feedback_type === 'feature') acc.features++;
          return acc;
        }, { total: 0, bugs: 0, features: 0 }) || { total: 0, bugs: 0, features: 0 };

        // Fetch enhancement count
        const { count: enhancementCount } = await supabase
          .from('enhancements')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'completed');

        // Calculate score
        const score = 
          feedbackStats.total * 10 + 
          feedbackStats.bugs * 5 + 
          feedbackStats.features * 3 + 
          (enhancementCount || 0) * 2 +
          daysInBeta * 1;

        // Determine rank level
        const currentLevel = RANK_LEVELS.reduce((acc, level) => {
          return score >= level.minScore ? level : acc;
        }, RANK_LEVELS[0]);

        const nextLevel = RANK_LEVELS.find(l => l.level === currentLevel.level + 1);
        const nextLevelScore = nextLevel?.minScore || currentLevel.minScore;
        const percentageToNext = nextLevel 
          ? ((score - currentLevel.minScore) / (nextLevel.minScore - currentLevel.minScore)) * 100
          : 100;

        // Check badges
        const earnedBadges = BADGES.map(badge => {
          let earned = false;
          
          if (badge.threshold.feedbackCount && feedbackStats.total >= badge.threshold.feedbackCount) {
            earned = true;
          }
          if (badge.threshold.bugCount && feedbackStats.bugs >= badge.threshold.bugCount) {
            earned = true;
          }
          if (badge.threshold.featureCount && feedbackStats.features >= badge.threshold.featureCount) {
            earned = true;
          }
          if (badge.threshold.enhancementCount && (enhancementCount || 0) >= badge.threshold.enhancementCount) {
            earned = true;
          }
          if (badge.threshold.daysInBeta && daysInBeta >= badge.threshold.daysInBeta) {
            earned = true;
          }

          return {
            ...badge,
            icon: Zap,
            earned,
          };
        });

        setRankData({
          rank: currentLevel.name,
          level: currentLevel.level,
          score,
          nextLevelScore,
          percentageToNext,
          badges: earnedBadges,
        });
      } catch (error) {
        console.error('Error fetching rank data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRankData();
  }, [userId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Beta Rank</CardTitle>
          <CardDescription>Level up by contributing to BeautifyAI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (!rankData) return null;

  const CurrentRankIcon = RANK_LEVELS.find(l => l.level === rankData.level)?.icon || Star;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Beta Rank</CardTitle>
        <CardDescription>Level up by contributing to BeautifyAI</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Rank */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full">
            <CurrentRankIcon className="h-12 w-12 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">{rankData.rank}</h3>
            <p className="text-sm text-muted-foreground">Level {rankData.level}</p>
          </div>
        </div>

        {/* Progress to Next Level */}
        {rankData.level < 5 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{rankData.score} points</span>
              <span>{rankData.nextLevelScore} points</span>
            </div>
            <Progress value={rankData.percentageToNext} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {Math.round(rankData.nextLevelScore - rankData.score)} points to next level
            </p>
          </div>
        )}

        {/* Badges */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Badges Earned</h4>
          <div className="flex flex-wrap gap-2">
            {rankData.badges.filter(b => b.earned).map((badge) => (
              <Badge
                key={badge.id}
                variant="secondary"
                className="gap-1"
                title={badge.description}
              >
                <badge.icon className="h-3 w-3" />
                {badge.name}
              </Badge>
            ))}
            {rankData.badges.filter(b => b.earned).length === 0 && (
              <p className="text-sm text-muted-foreground">No badges earned yet</p>
            )}
          </div>
        </div>

        {/* Available Badges */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Available Badges</h4>
          <div className="flex flex-wrap gap-2">
            {rankData.badges.filter(b => !b.earned).map((badge) => (
              <Badge
                key={badge.id}
                variant="outline"
                className="gap-1 opacity-50"
                title={badge.description}
              >
                <badge.icon className="h-3 w-3" />
                {badge.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}