'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  ExternalLink, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  History
} from 'lucide-react';
import { useCanvaHistory } from '@/hooks/use-canva-history';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';

interface CanvaHistoryProps {
  onSelectUrl?: (url: string) => void;
}

export function CanvaHistory({ onSelectUrl }: CanvaHistoryProps) {
  const { history, removeFromHistory, clearHistory } = useCanvaHistory();

  if (history.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'manual_required':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success':
        return 'Imported';
      case 'failed':
        return 'Failed';
      case 'manual_required':
        return 'Manual upload required';
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <CardTitle>Recent Imports</CardTitle>
          </div>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="text-muted-foreground"
            >
              Clear all
            </Button>
          )}
        </div>
        <CardDescription>
          Your recently imported Canva designs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(item.status)}
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate max-w-[200px]">
                        {item.fileName || `Design ${item.designId.slice(0, 8)}...`}
                      </p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{getStatusLabel(item.status)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {item.status === 'success' && onSelectUrl && (
                      <DropdownMenuItem onClick={() => onSelectUrl(item.url)}>
                        Use this URL
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => window.open(item.url, '_blank')}
                    >
                      Open in Canva
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => removeFromHistory(item.id)}
                      className="text-destructive"
                    >
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}