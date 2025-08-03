'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell,
  Sparkles,
  Bug,
  Rocket,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Announcement {
  id: string;
  type: 'feature' | 'fix' | 'update' | 'alert';
  title: string;
  description: string;
  date: Date;
  isNew: boolean;
}

const announcements: Announcement[] = [
  {
    id: '1',
    type: 'feature',
    title: 'Batch Processing Now Available',
    description: 'You can now enhance multiple documents at once! Upload up to 10 files and process them simultaneously.',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    isNew: true,
  },
  {
    id: '2',
    type: 'fix',
    title: 'Fixed Export Issues',
    description: 'Resolved the bug causing exports to fail for documents with special characters in filenames.',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    isNew: true,
  },
  {
    id: '3',
    type: 'update',
    title: 'AI Model Improvements',
    description: 'Updated our AI models for 30% faster processing and better quality enhancements.',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    isNew: false,
  },
  {
    id: '4',
    type: 'alert',
    title: 'Scheduled Maintenance',
    description: 'We\'ll be performing maintenance on Saturday, 2 AM - 4 AM EST. Service may be intermittent.',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    isNew: false,
  },
  {
    id: '5',
    type: 'feature',
    title: 'Custom Style Templates',
    description: 'Beta testers can now create and save custom enhancement style templates.',
    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
    isNew: false,
  },
];

export function BetaAnnouncements() {
  const getAnnouncementIcon = (type: Announcement['type']) => {
    switch (type) {
      case 'feature':
        return { icon: Sparkles, color: 'text-purple-600', bgColor: 'bg-purple-100' };
      case 'fix':
        return { icon: Bug, color: 'text-green-600', bgColor: 'bg-green-100' };
      case 'update':
        return { icon: Rocket, color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case 'alert':
        return { icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-100' };
    }
  };

  const getTypeBadge = (type: Announcement['type']) => {
    const variants = {
      feature: 'default',
      fix: 'secondary',
      update: 'outline',
      alert: 'destructive',
    } as const;

    return (
      <Badge variant={variants[type]} className="text-xs">
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Beta Announcements</CardTitle>
            <CardDescription>Latest updates and changes</CardDescription>
          </div>
          <Bell className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {announcements.map((announcement) => {
              const { icon: Icon, color, bgColor } = getAnnouncementIcon(announcement.type);
              
              return (
                <div
                  key={announcement.id}
                  className="flex gap-3 pb-4 border-b last:border-0 last:pb-0"
                >
                  <div className={`p-2 rounded-lg h-fit ${bgColor}`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{announcement.title}</h4>
                          {announcement.isNew && (
                            <Badge variant="secondary" className="text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {announcement.description}
                        </p>
                      </div>
                      {getTypeBadge(announcement.type)}
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(announcement.date, { addSuffix: true })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* View All Link */}
        <div className="mt-4 pt-4 border-t">
          <a
            href="/beta/announcements"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all announcements
            <CheckCircle className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}