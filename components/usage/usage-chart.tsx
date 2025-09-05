'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Zap, TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { createClientUsageTracker } from '@/lib/usage/tracking-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UsageForecast } from './usage-forecast';
import { Loading } from '@/components/ui/loading';

interface UsageStats {
  currentMonth: {
    total: number;
    byAction: Record<string, number>;
    dailyUsage: Array<{ date: string; count: number }>;
  };
  lastMonth: {
    total: number;
  };
  allTime: {
    total: number;
  };
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

export function UsageChart() {
  const { user } = useAuth();
  const { tierDetails, getRemainingCredits, hasCredits } = useSubscription();
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUsageStats();
    }
  }, [user]);

  const loadUsageStats = async () => {
    if (!user) return;
    
    try {
      const tracker = createClientUsageTracker();
      const stats = await tracker.getUsageStats(user.id);
      setUsageStats(stats);
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !usageStats) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loading size="xl" text="Loading usage data..." />
          </div>
        </CardContent>
      </Card>
    );
  }

  const remainingCredits = getRemainingCredits();
  const totalCredits = tierDetails.features.monthlyCredits;
  const usagePercentage = ((totalCredits - remainingCredits) / totalCredits) * 100;

  // Format daily usage data for chart
  const dailyChartData = usageStats.currentMonth.dailyUsage.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    credits: item.count,
  }));

  // Format action breakdown for pie chart
  const actionData = Object.entries(usageStats.currentMonth.byAction)
    .filter(([_, count]) => count > 0)
    .map(([action, count]) => ({
      name: action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
    }));

  const monthlyGrowth = usageStats.lastMonth.total > 0
    ? ((usageStats.currentMonth.total - usageStats.lastMonth.total) / usageStats.lastMonth.total) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Usage</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageStats.currentMonth.total}</div>
            <p className="text-xs text-muted-foreground">
              of {totalCredits} monthly credits
            </p>
            <Progress value={usagePercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{remainingCredits}</div>
            <p className="text-xs text-muted-foreground">
              credits available
            </p>
            {!hasCredits() && (
              <Badge variant="destructive" className="mt-2">Limit Reached</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageStats.lastMonth.total}</div>
            <p className="text-xs text-muted-foreground">
              {monthlyGrowth > 0 ? '+' : ''}{monthlyGrowth.toFixed(0)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">All Time</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usageStats.allTime.total}</div>
            <p className="text-xs text-muted-foreground">
              total enhancements
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Charts */}
      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily Usage</TabsTrigger>
          <TabsTrigger value="breakdown">Usage Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Usage Trend</CardTitle>
              <CardDescription>
                Your credit usage over the current month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="credits" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usage by Type</CardTitle>
              <CardDescription>
                How you&apos;re using your credits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {actionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={actionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {actionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No usage data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Usage Forecast */}
      <UsageForecast />

      {/* Upgrade Prompt */}
      {usagePercentage >= 80 && hasCredits() && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Approaching Usage Limit
            </CardTitle>
            <CardDescription>
              You&apos;ve used {Math.round(usagePercentage)}% of your monthly credits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/app/settings/billing">
              <Button>Upgrade Plan</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}