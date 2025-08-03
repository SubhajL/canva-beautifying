'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export function BetaNotificationBadge() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      // Poll for new messages every 5 minutes
      const interval = setInterval(fetchUnreadCount, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchRecentMessages();
    }
  }, [isOpen, user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/v1/beta/messages?unread_only=true&limit=0', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchRecentMessages = async () => {
    try {
      const response = await fetch('/api/v1/beta/messages?limit=5&unread_only=true', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentMessages(data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch recent messages:', error);
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await fetch(`/api/v1/beta/messages/${messageId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      // Update local state
      setUnreadCount(prev => Math.max(0, prev - 1));
      setRecentMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  };

  const categoryColors = {
    announcement: 'text-blue-600',
    feature_update: 'text-purple-600',
    survey: 'text-green-600',
    maintenance: 'text-orange-600',
    feedback_request: 'text-indigo-600',
    bug_fix: 'text-red-600',
    general: 'text-gray-600'
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Beta Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} unread
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {recentMessages.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No unread messages
          </div>
        ) : (
          <>
            {recentMessages.map((message) => (
              <DropdownMenuItem
                key={message.id}
                className="flex flex-col items-start p-4 cursor-pointer hover:bg-gray-50"
                onClick={(e) => {
                  e.preventDefault();
                  markAsRead(message.id);
                  router.push(`/app/beta/announcements?message=${message.id}`);
                }}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={cn(
                    "text-xs font-medium",
                    categoryColors[message.category as keyof typeof categoryColors]
                  )}>
                    {message.category.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.publish_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium line-clamp-1">{message.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {message.content}
                </p>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-center text-sm text-primary cursor-pointer"
              onClick={() => router.push('/app/beta/announcements')}
            >
              View all announcements
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}