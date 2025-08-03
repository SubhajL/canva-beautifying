'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { 
  MessageSquare, 
  Bug, 
  Lightbulb, 
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface FeedbackHistoryProps {
  userId: string;
}

interface Feedback {
  id: string;
  feedback_type: 'bug' | 'feature' | 'improvement' | 'general';
  title: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'wont_fix';
  priority: 'low' | 'medium' | 'high' | 'critical';
  rating?: number;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export function FeedbackHistory({ userId }: FeedbackHistoryProps) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const supabase = createClient();
        
        const { data, error } = await supabase
          .from('beta_feedback')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setFeedback(data);
        }
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [userId]);

  const getTypeIcon = (type: Feedback['feedback_type']) => {
    switch (type) {
      case 'bug':
        return { icon: Bug, color: 'text-red-600' };
      case 'feature':
        return { icon: Lightbulb, color: 'text-yellow-600' };
      case 'improvement':
        return { icon: Zap, color: 'text-purple-600' };
      case 'general':
        return { icon: MessageSquare, color: 'text-blue-600' };
    }
  };

  const getStatusIcon = (status: Feedback['status']) => {
    switch (status) {
      case 'pending':
        return { icon: Clock, color: 'text-yellow-600' };
      case 'reviewed':
        return { icon: AlertCircle, color: 'text-blue-600' };
      case 'resolved':
        return { icon: CheckCircle, color: 'text-green-600' };
      case 'wont_fix':
        return { icon: XCircle, color: 'text-gray-600' };
    }
  };

  const getStatusBadge = (status: Feedback['status']) => {
    const variants = {
      pending: 'secondary',
      reviewed: 'outline',
      resolved: 'default',
      wont_fix: 'destructive',
    } as const;

    return (
      <Badge variant={variants[status]} className="text-xs">
        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: Feedback['priority']) => {
    const colors = {
      low: 'text-gray-600 bg-gray-100',
      medium: 'text-yellow-600 bg-yellow-100',
      high: 'text-orange-600 bg-orange-100',
      critical: 'text-red-600 bg-red-100',
    };

    return (
      <Badge variant="outline" className={`text-xs ${colors[priority]}`}>
        {priority.charAt(0).toUpperCase() + priority.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feedback History</CardTitle>
          <CardDescription>Track the status of your submitted feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedFeedback = showAll ? feedback : feedback.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Feedback History</CardTitle>
            <CardDescription>Track the status of your submitted feedback</CardDescription>
          </div>
          {feedback.length > 0 && (
            <Badge variant="secondary">
              {feedback.length} Total
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {feedback.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No feedback submitted yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start by sharing your thoughts using the quick feedback form above
            </p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">Type</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedFeedback.map((item) => {
                    const { icon: TypeIcon, color: typeColor } = getTypeIcon(item.feedback_type);
                    const { icon: StatusIcon, color: statusColor } = getStatusIcon(item.status);
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <TypeIcon className={`h-4 w-4 ${typeColor}`} />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {item.description}
                            </p>
                            {item.admin_notes && (
                              <p className="text-xs text-primary mt-1">
                                Admin: {item.admin_notes}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <StatusIcon className={`h-3 w-3 ${statusColor}`} />
                            {getStatusBadge(item.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getPriorityBadge(item.priority)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="View details"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {feedback.length > 5 && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Less' : `Show All (${feedback.length})`}
                </Button>
              </div>
            )}

            {/* Feedback Stats Summary */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {feedback.filter(f => f.status === 'resolved').length}
                </p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {feedback.filter(f => f.status === 'reviewed').length}
                </p>
                <p className="text-xs text-muted-foreground">Under Review</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {feedback.filter(f => f.status === 'pending').length}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {Math.round((feedback.filter(f => f.status === 'resolved').length / feedback.length) * 100) || 0}%
                </p>
                <p className="text-xs text-muted-foreground">Resolution Rate</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}