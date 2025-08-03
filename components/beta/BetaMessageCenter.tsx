'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, MessageSquare, Bug, Star, Wrench, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BetaMessage {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  publish_at: string;
  expires_at: string | null;
  is_read: boolean;
}

const categoryIcons = {
  announcement: MessageSquare,
  feature_update: Star,
  survey: HelpCircle,
  maintenance: Wrench,
  feedback_request: MessageSquare,
  bug_fix: Bug,
  general: Bell
};

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800'
};

export function BetaMessageCenter() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<BetaMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMessages();
    }
  }, [user, selectedCategory, showUnreadOnly]);

  const fetchMessages = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      if (showUnreadOnly) {
        params.append('unread_only', 'true');
      }

      const response = await fetch(`/api/v1/beta/messages?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        setUnreadCount(data.unread_count);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      const response = await fetch(`/api/v1/beta/messages/${messageId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId ? { ...msg, is_read: true } : msg
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const trackInteraction = async (messageId: string, type: string, data?: any) => {
    try {
      await fetch(`/api/v1/beta/messages/${messageId}/interact`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          interaction_type: type,
          interaction_data: data
        })
      });
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  };

  const MessageCard = ({ message }: { message: BetaMessage }) => {
    const Icon = categoryIcons[message.category as keyof typeof categoryIcons] || Bell;
    
    return (
      <Card 
        className={cn(
          "mb-4 cursor-pointer transition-all hover:shadow-md",
          !message.is_read && "border-blue-500 bg-blue-50/5"
        )}
        onClick={() => {
          if (!message.is_read) {
            markAsRead(message.id);
          }
          trackInteraction(message.id, 'click');
        }}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Icon className={cn(
                "h-5 w-5 mt-0.5",
                !message.is_read ? "text-blue-600" : "text-gray-500"
              )} />
              <div className="space-y-1">
                <CardTitle className="text-lg">{message.title}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {message.category.replace('_', ' ')}
                  </Badge>
                  <Badge className={cn("text-xs", priorityColors[message.priority as keyof typeof priorityColors])}>
                    {message.priority}
                  </Badge>
                  {!message.is_read && (
                    <Badge variant="default" className="text-xs">
                      New
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {format(new Date(message.publish_at), 'MMM d, yyyy')}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{message.content}</p>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Beta Announcements</h2>
        {unreadCount > 0 && (
          <Badge variant="default" className="text-sm">
            {unreadCount} unread
          </Badge>
        )}
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="grid grid-cols-4 lg:grid-cols-8 w-full">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="announcement">Announcements</TabsTrigger>
          <TabsTrigger value="feature_update">Features</TabsTrigger>
          <TabsTrigger value="survey">Surveys</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="feedback_request">Feedback</TabsTrigger>
          <TabsTrigger value="bug_fix">Bug Fixes</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={showUnreadOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            >
              Show unread only
            </Button>
          </div>
        </div>

        <TabsContent value={selectedCategory} className="mt-4">
          <ScrollArea className="h-[600px]">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {showUnreadOnly ? 'No unread messages' : 'No messages in this category'}
              </div>
            ) : (
              messages.map(message => (
                <MessageCard key={message.id} message={message} />
              ))
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}