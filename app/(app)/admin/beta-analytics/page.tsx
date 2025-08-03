'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Activity, 
  ArrowUpRight,
  ArrowDownRight,
  MousePointer,
  Timer
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

interface AnalyticsData {
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalEvents: number;
    avgSessionDuration: number;
    userGrowth: number;
    eventGrowth: number;
  };
  userActivity: Array<{
    date: string;
    activeUsers: number;
    newUsers: number;
    events: number;
  }>;
  featureUsage: Array<{
    feature: string;
    usage: number;
    users: number;
  }>;
  feedbackStats: {
    total: number;
    byType: Record<string, number>;
    avgRating: number;
    resolutionRate: number;
  };
  sessionMetrics: {
    avgDuration: number;
    avgPageViews: number;
    bounceRate: number;
    topPages: Array<{
      path: string;
      views: number;
      avgTime: number;
    }>;
  };
  userEngagement: Array<{
    userId: string;
    email: string;
    score: number;
    feedbackCount: number;
    lastActive: string | null;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function BetaAnalyticsDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

  // Check admin access
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        router.push('/dashboard');
      }
    };

    checkAdmin();
  }, [user, router]);

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const endDate = new Date();
      const startDate = subDays(endDate, parseInt(dateRange));

      // Fetch overview metrics
      const { data: betaUsers } = await supabase
        .from('user_profiles')
        .select('id, beta_joined_at')
        .eq('is_beta_user', true);

      const { data: events } = await supabase
        .from('beta_analytics')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const { data: feedback } = await supabase
        .from('beta_feedback')
        .select('*');

      // Calculate overview metrics
      const uniqueActiveUsers = new Set(events?.map(e => e.user_id) || []).size;
      const previousPeriodStart = subDays(startDate, parseInt(dateRange));
      
      const { data: previousEvents } = await supabase
        .from('beta_analytics')
        .select('user_id')
        .gte('created_at', previousPeriodStart.toISOString())
        .lt('created_at', startDate.toISOString());

      const previousUniqueUsers = new Set(previousEvents?.map(e => e.user_id) || []).size;
      const userGrowth = previousUniqueUsers > 0 
        ? ((uniqueActiveUsers - previousUniqueUsers) / previousUniqueUsers) * 100
        : 0;

      // Calculate daily activity
      interface DailyActivityData {
        date: string;
        activeUsers: Set<string>;
        events: number;
        newUsers: Set<string>;
      }
      const dailyActivity: Record<string, DailyActivityData> = {};
      events?.forEach(event => {
        const date = format(new Date(event.created_at), 'yyyy-MM-dd');
        if (!dailyActivity[date]) {
          dailyActivity[date] = {
            date,
            activeUsers: new Set(),
            events: 0,
            newUsers: new Set(),
          };
        }
        dailyActivity[date].activeUsers.add(event.user_id);
        dailyActivity[date].events++;
      });

      // Add new users
      betaUsers?.forEach(user => {
        if (user.beta_joined_at) {
          const joinDate = format(new Date(user.beta_joined_at), 'yyyy-MM-dd');
          if (dailyActivity[joinDate]) {
            dailyActivity[joinDate].newUsers.add(user.id);
          }
        }
      });

      const userActivity = Object.values(dailyActivity)
        .map(day => ({
          date: day.date,
          activeUsers: day.activeUsers.size,
          newUsers: day.newUsers.size,
          events: day.events,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate feature usage
      const featureEvents = events?.filter(e => e.event_type === 'feature_usage') || [];
      const featureMap: Record<string, { usage: number; users: Set<string> }> = {};
      
      featureEvents.forEach(event => {
        const feature = event.event_label || 'Unknown';
        if (!featureMap[feature]) {
          featureMap[feature] = { usage: 0, users: new Set() };
        }
        featureMap[feature].usage++;
        featureMap[feature].users.add(event.user_id);
      });

      const featureUsage = Object.entries(featureMap)
        .map(([feature, data]) => ({
          feature,
          usage: data.usage,
          users: data.users.size,
        }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 10);

      // Calculate feedback stats
      const feedbackByType = feedback?.reduce((acc, f) => {
        acc[f.feedback_type] = (acc[f.feedback_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const ratings = feedback?.filter(f => f.rating).map(f => f.rating) || [];
      const avgRating = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : 0;

      const resolvedFeedback = feedback?.filter(f => f.status === 'resolved').length || 0;
      const resolutionRate = feedback?.length 
        ? (resolvedFeedback / feedback.length) * 100 
        : 0;

      // Calculate session metrics
      const sessionEvents = events?.filter(e => 
        e.event_type === 'session_start' || e.event_type === 'session_end'
      ) || [];
      
      interface SessionData {
        start?: Date;
        duration?: number;
        pageViews?: number;
      }
      const sessions: Record<string, SessionData> = {};
      sessionEvents.forEach(event => {
        const sessionId = event.session_id;
        if (!sessions[sessionId]) {
          sessions[sessionId] = {};
        }
        if (event.event_type === 'session_start') {
          sessions[sessionId].start = new Date(event.created_at);
        } else if (event.event_type === 'session_end' && event.metadata?.duration) {
          sessions[sessionId].duration = event.metadata.duration;
          sessions[sessionId].pageViews = event.metadata.pageViews || 0;
        }
      });

      const validSessions = Object.values(sessions).filter(s => s.duration !== undefined);
      const avgSessionDuration = validSessions.length > 0
        ? validSessions.reduce((acc, s) => acc + (s.duration || 0), 0) / validSessions.length / 60000 // Convert to minutes
        : 0;

      const avgPageViews = validSessions.length > 0
        ? validSessions.reduce((acc, s) => acc + (s.pageViews || 0), 0) / validSessions.length
        : 0;

      // Calculate top pages
      const pageViewEvents = events?.filter(e => e.event_type === 'page_view') || [];
      const pageMap: Record<string, { views: number; totalTime: number }> = {};
      
      pageViewEvents.forEach(event => {
        const path = event.event_label || event.page_url || 'Unknown';
        if (!pageMap[path]) {
          pageMap[path] = { views: 0, totalTime: 0 };
        }
        pageMap[path].views++;
      });

      const topPages = Object.entries(pageMap)
        .map(([path, data]) => ({
          path,
          views: data.views,
          avgTime: data.totalTime / data.views / 1000, // Convert to seconds
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Calculate user engagement
      interface UserEngagementData {
        userId: string;
        feedbackCount: number;
        events: number;
        lastActive: Date | null;
      }
      const userEngagementMap: Record<string, UserEngagementData> = {};
      
      betaUsers?.forEach(user => {
        userEngagementMap[user.id] = {
          userId: user.id,
          feedbackCount: 0,
          events: 0,
          lastActive: null,
        };
      });

      events?.forEach(event => {
        if (userEngagementMap[event.user_id]) {
          userEngagementMap[event.user_id].events++;
          const eventDate = new Date(event.created_at);
          const userEngagement = userEngagementMap[event.user_id];
          if (!userEngagement.lastActive || eventDate > userEngagement.lastActive) {
            userEngagementMap[event.user_id].lastActive = eventDate;
          }
        }
      });

      feedback?.forEach(f => {
        if (userEngagementMap[f.user_id]) {
          userEngagementMap[f.user_id].feedbackCount++;
        }
      });

      // Fetch user emails
      const userIds = Object.keys(userEngagementMap);
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, email')
        .in('id', userIds);

      const emailMap = userProfiles?.reduce((acc, profile) => {
        acc[profile.id] = profile.email;
        return acc;
      }, {} as Record<string, string>) || {};

      const userEngagement = Object.values(userEngagementMap)
        .map(user => ({
          userId: user.userId,
          email: emailMap[user.userId] || 'Unknown',
          score: user.events + (user.feedbackCount * 10), // Simple engagement score
          feedbackCount: user.feedbackCount,
          lastActive: user.lastActive ? user.lastActive.toISOString() : null,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      setAnalyticsData({
        overview: {
          totalUsers: betaUsers?.length || 0,
          activeUsers: uniqueActiveUsers,
          totalEvents: events?.length || 0,
          avgSessionDuration,
          userGrowth,
          eventGrowth: events?.length || 0,
        },
        userActivity,
        featureUsage,
        feedbackStats: {
          total: feedback?.length || 0,
          byType: feedbackByType,
          avgRating,
          resolutionRate,
        },
        sessionMetrics: {
          avgDuration: avgSessionDuration,
          avgPageViews,
          bounceRate: 0, // TODO: Calculate bounce rate
          topPages,
        },
        userEngagement,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="grid gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Beta Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Monitor beta program performance and user engagement
          </p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center justify-between">
              <span>Total Beta Users</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl">{analyticsData?.overview.totalUsers || 0}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center justify-between">
              <span>Active Users</span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {analyticsData?.overview.activeUsers || 0}
              {analyticsData?.overview.userGrowth !== undefined && (
                <span className={`text-sm flex items-center ${
                  analyticsData.overview.userGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {analyticsData.overview.userGrowth >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {Math.abs(analyticsData.overview.userGrowth).toFixed(1)}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center justify-between">
              <span>Total Events</span>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl">{analyticsData?.overview.totalEvents || 0}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center justify-between">
              <span>Avg Session</span>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardDescription>
            <CardTitle className="text-2xl">
              {analyticsData?.overview.avgSessionDuration.toFixed(1) || 0}m
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="activity">User Activity</TabsTrigger>
          <TabsTrigger value="features">Feature Usage</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Activity Over Time</CardTitle>
              <CardDescription>
                Daily active users, new users, and events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData?.userActivity || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="events" 
                      stackId="1"
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.6}
                      name="Events"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="activeUsers" 
                      stackId="2"
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.6}
                      name="Active Users"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="newUsers" 
                      stackId="3"
                      stroke="#f59e0b" 
                      fill="#f59e0b" 
                      fillOpacity={0.6}
                      name="New Users"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage</CardTitle>
              <CardDescription>
                Most used beta features by event count and unique users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData?.featureUsage || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="feature" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="usage" fill="#3b82f6" name="Total Usage" />
                    <Bar dataKey="users" fill="#10b981" name="Unique Users" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Feedback Distribution</CardTitle>
                <CardDescription>
                  Breakdown by feedback type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(analyticsData?.feedbackStats.byType || {}).map(([type, count]) => ({
                          name: type,
                          value: count,
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {Object.entries(analyticsData?.feedbackStats.byType || {}).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feedback Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Feedback</span>
                  <span className="text-2xl font-bold">{analyticsData?.feedbackStats.total || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Average Rating</span>
                  <span className="text-2xl font-bold flex items-center gap-1">
                    {analyticsData?.feedbackStats.avgRating.toFixed(1) || 0}
                    <span className="text-yellow-500">★</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Resolution Rate</span>
                  <span className="text-2xl font-bold">
                    {analyticsData?.feedbackStats.resolutionRate.toFixed(0) || 0}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Duration</span>
                  <span className="text-2xl font-bold">
                    {analyticsData?.sessionMetrics.avgDuration.toFixed(1) || 0}m
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Avg Page Views</span>
                  <span className="text-2xl font-bold">
                    {analyticsData?.sessionMetrics.avgPageViews.toFixed(1) || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bounce Rate</span>
                  <span className="text-2xl font-bold">
                    {analyticsData?.sessionMetrics.bounceRate.toFixed(0) || 0}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Pages</CardTitle>
                <CardDescription>Most visited pages by beta users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analyticsData?.sessionMetrics.topPages.slice(0, 5).map((page, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[200px]">{page.path}</span>
                      <Badge variant="secondary">{page.views} views</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Beta Users</CardTitle>
              <CardDescription>
                Most engaged beta users by activity score
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.userEngagement.map((user, index) => (
                  <div key={user.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">#{index + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{user.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.feedbackCount} feedback · Last active {user.lastActive ? formatDistanceToNow(new Date(user.lastActive)) + ' ago' : 'Never'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">Score: {user.score}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  return `${Math.floor(diffInSeconds / 86400)}d`;
}