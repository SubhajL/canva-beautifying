'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, 
  Bug, 
  Lightbulb, 
  Zap, 
  MessageCircle,
  Star,
  ChevronLeft,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface BetaFeedback {
  id: string;
  user_id: string;
  feedback_type: 'bug' | 'feature' | 'improvement' | 'general';
  category?: string;
  rating?: number;
  title: string;
  description: string;
  page_url?: string;
  browser_info?: {
    userAgent?: string;
    platform?: string;
    language?: string;
    screenResolution?: string;
  };
  attachments?: {
    url: string;
    name?: string;
    type?: string;
    size?: number;
  }[];
  status: 'pending' | 'reviewed' | 'resolved' | 'wont_fix';
  priority: 'low' | 'medium' | 'high' | 'critical';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    full_name: string;
    email: string;
  };
}

interface FeedbackStats {
  total: number;
  pending: number;
  resolved: number;
  avgRating: number;
  byType: Record<string, number>;
}

const typeIcons = {
  bug: Bug,
  feature: Lightbulb,
  improvement: Zap,
  general: MessageCircle,
};

const statusColors = {
  pending: 'bg-yellow-500',
  reviewed: 'bg-blue-500',
  resolved: 'bg-green-500',
  wont_fix: 'bg-gray-500',
};

const priorityColors = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export default function BetaFeedbackManagement() {
  const router = useRouter();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<BetaFeedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<BetaFeedback | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

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

  // Load feedback and stats
  useEffect(() => {
    loadFeedback();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, typeFilter, statusFilter, priorityFilter, sortBy]);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('beta_feedback')
        .select(`
          *,
          user_profiles!inner(full_name, email)
        `, { count: 'exact' });

      // Apply filters
      if (typeFilter !== 'all') {
        query = query.eq('feedback_type', typeFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Sorting
      const isAscending = sortBy === 'rating';
      query = query.order(sortBy, { ascending: isAscending });

      // Pagination
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setFeedback(data || []);
      setTotalPages(Math.ceil((count || 0) / itemsPerPage));
    } catch (error) {
      console.error('Error loading feedback:', error);
      toast.error('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const supabase = createClient();
      
      // Get overall stats
      const { data: allFeedback } = await supabase
        .from('beta_feedback')
        .select('feedback_type, status, rating');

      if (allFeedback) {
        const stats: FeedbackStats = {
          total: allFeedback.length,
          pending: allFeedback.filter(f => f.status === 'pending').length,
          resolved: allFeedback.filter(f => f.status === 'resolved').length,
          avgRating: allFeedback
            .filter(f => f.rating)
            .reduce((acc, f) => acc + (f.rating || 0), 0) / 
            allFeedback.filter(f => f.rating).length || 0,
          byType: allFeedback.reduce((acc, f) => {
            acc[f.feedback_type] = (acc[f.feedback_type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const updateFeedback = async (
    feedbackId: string,
    updates: Partial<BetaFeedback>
  ) => {
    setIsUpdating(true);
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('beta_feedback')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', feedbackId);

      if (error) throw error;

      toast.success('Feedback updated successfully');
      loadFeedback();
      setSelectedFeedback(null);
      setAdminNotes('');
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast.error('Failed to update feedback');
    } finally {
      setIsUpdating(false);
    }
  };

  const renderFeedbackCard = (item: BetaFeedback) => {
    const Icon = typeIcons[item.feedback_type];
    
    return (
      <Card 
        key={item.id} 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => {
          setSelectedFeedback(item);
          setAdminNotes(item.admin_notes || '');
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <Badge variant="outline">{item.feedback_type}</Badge>
              <Badge className={priorityColors[item.priority]} variant="secondary">
                {item.priority}
              </Badge>
              <Badge className={statusColors[item.status]} variant="secondary">
                {item.status}
              </Badge>
            </div>
            {item.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                <span className="text-sm font-medium">{item.rating}</span>
              </div>
            )}
          </div>
          <CardTitle className="text-base mt-2">{item.title}</CardTitle>
          <CardDescription className="text-xs">
            {item.user_profiles?.full_name || 'Anonymous'} • {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {item.description}
          </p>
          {item.page_url && (
            <p className="text-xs text-muted-foreground mt-2">
              Page: {new URL(item.page_url).pathname}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading && feedback.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-64 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Beta Feedback Management</h1>
        <p className="text-muted-foreground mt-2">
          Review and manage feedback from beta users
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Feedback</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending Review</CardDescription>
              <CardTitle className="text-2xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-2xl text-green-600">{stats.resolved}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Average Rating</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                {stats.avgRating.toFixed(1)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search feedback..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="improvement">Improvement</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Latest</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      <div className="grid gap-4">
        {feedback.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No feedback found</p>
            </CardContent>
          </Card>
        ) : (
          feedback.map(renderFeedbackCard)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Feedback Detail Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedFeedback && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {React.createElement(typeIcons[selectedFeedback.feedback_type], {
                    className: "h-5 w-5",
                  })}
                  {selectedFeedback.title}
                </DialogTitle>
                <DialogDescription>
                  Submitted by {selectedFeedback.user_profiles?.full_name} on{' '}
                  {format(new Date(selectedFeedback.created_at), 'PPp')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-4">
                <div className="flex gap-2">
                  <Badge variant="outline">{selectedFeedback.feedback_type}</Badge>
                  <Badge className={priorityColors[selectedFeedback.priority]} variant="secondary">
                    {selectedFeedback.priority}
                  </Badge>
                  <Badge className={statusColors[selectedFeedback.status]} variant="secondary">
                    {selectedFeedback.status}
                  </Badge>
                  {selectedFeedback.rating && (
                    <div className="flex items-center gap-1 ml-auto">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < selectedFeedback.rating!
                              ? 'fill-yellow-500 text-yellow-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedFeedback.description}</p>
                </div>

                {selectedFeedback.page_url && (
                  <div>
                    <Label className="text-sm font-medium">Page URL</Label>
                    <a
                      href={selectedFeedback.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-1 block"
                    >
                      {selectedFeedback.page_url}
                    </a>
                  </div>
                )}

                {selectedFeedback.attachments && selectedFeedback.attachments.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Attachments</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {selectedFeedback.attachments.map((attachment, i) => (
                        <a
                          key={i}
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block relative w-full h-32"
                        >
                          <Image
                            src={attachment.url}
                            alt={`Attachment ${i + 1}`}
                            fill
                            className="rounded border object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="admin-notes">Admin Notes</Label>
                  <Textarea
                    id="admin-notes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes about this feedback..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={selectedFeedback.status}
                      onValueChange={(value) =>
                        setSelectedFeedback({
                          ...selectedFeedback,
                          status: value as 'pending' | 'reviewed' | 'resolved' | 'wont_fix',
                        })
                      }
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="reviewed">Reviewed</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={selectedFeedback.priority}
                      onValueChange={(value) =>
                        setSelectedFeedback({
                          ...selectedFeedback,
                          priority: value as 'low' | 'medium' | 'high' | 'critical',
                        })
                      }
                    >
                      <SelectTrigger id="priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    updateFeedback(selectedFeedback.id, {
                      status: selectedFeedback.status,
                      priority: selectedFeedback.priority,
                      admin_notes: adminNotes,
                    })
                  }
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Updating...' : 'Update Feedback'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}