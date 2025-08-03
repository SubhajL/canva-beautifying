'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Search, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Database } from '@/lib/supabase/database.types';

type UserUsage = {
  id: string;
  email: string;
  name: string | null;
  subscription_tier: Database['public']['Enums']['subscription_tier'];
  usage_count: number;
  monthlyLimit: number;
  percentageUsed: number;
};

type UsageRecord = Database['public']['Tables']['usage_tracking']['Row'] & {
  user: {
    email: string;
    name: string | null;
  };
};

export default function AdminUsagePage() {
  const [userUsage, setUserUsage] = useState<UserUsage[]>([]);
  const [recentUsage, setRecentUsage] = useState<UsageRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAdminAccess = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Check if user is admin (you should implement proper admin check)
    // For now, we'll check if email is in admin list
    const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
    setIsAdmin(user?.email ? adminEmails.includes(user.email) : false);
    
    if (user?.email && adminEmails.includes(user.email)) {
      await loadUsageData();
    }
    
    setLoading(false);
  };

  const loadUsageData = async () => {
    const supabase = createClient();
    
    // Load user usage summary
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, subscription_tier, usage_count');
      
    if (usersError) {
      console.error('Failed to load users:', usersError);
      return;
    }

    // Load subscription limits
    const { data: limits, error: limitsError } = await supabase
      .from('subscription_limits')
      .select('tier, monthly_credits');
      
    if (limitsError) {
      console.error('Failed to load limits:', limitsError);
      return;
    }

    // Create a map of tier limits
    const limitMap = new Map(limits?.map(l => [l.tier, l.monthly_credits]) || []);

    // Calculate usage percentages
    const usageData: UserUsage[] = (users || []).map(user => {
      const monthlyLimit = limitMap.get(user.subscription_tier) || 10;
      const percentageUsed = (user.usage_count / monthlyLimit) * 100;
      
      return {
        ...user,
        monthlyLimit,
        percentageUsed,
      };
    });

    setUserUsage(usageData);

    // Load recent usage records
    const { data: recentData, error: recentError } = await supabase
      .from('usage_tracking')
      .select(`
        *,
        user:users!user_id (
          email,
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (recentError) {
      console.error('Failed to load recent usage:', recentError);
      return;
    }

    setRecentUsage(recentData as unknown as UsageRecord[]);
  };

  const exportUsageReport = () => {
    const csv = [
      ['Email', 'Name', 'Tier', 'Usage', 'Limit', 'Percentage'].join(','),
      ...userUsage.map(user => 
        [
          user.email,
          user.name || '',
          user.subscription_tier,
          user.usage_count,
          user.monthlyLimit,
          `${user.percentageUsed.toFixed(1)}%`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredUsers = userUsage.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to view this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usage Reports</h1>
          <p className="text-muted-foreground mt-2">
            Monitor user usage and subscription metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => loadUsageData()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportUsageReport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userUsage.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">At Limit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userUsage.filter(u => u.percentageUsed >= 100).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Near Limit (80%+)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userUsage.filter(u => u.percentageUsed >= 80 && u.percentageUsed < 100).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {userUsage.reduce((sum, u) => sum + u.usage_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Usage</TabsTrigger>
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead className="text-right">Limit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.email}</div>
                        {user.name && (
                          <div className="text-sm text-muted-foreground">{user.name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.subscription_tier}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{user.usage_count}</TableCell>
                    <TableCell className="text-right">{user.monthlyLimit}</TableCell>
                    <TableCell>
                      {user.percentageUsed >= 100 ? (
                        <Badge variant="destructive">Limit Reached</Badge>
                      ) : user.percentageUsed >= 80 ? (
                        <Badge variant="secondary">Near Limit</Badge>
                      ) : (
                        <Badge variant="outline">{user.percentageUsed.toFixed(0)}% Used</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentUsage.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {new Date(record.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{record.user.email}</div>
                        {record.user.name && (
                          <div className="text-muted-foreground">{record.user.name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{record.action}</TableCell>
                    <TableCell className="text-right">{record.credits_used}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}