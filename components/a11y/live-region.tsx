'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

type AriaLive = 'off' | 'polite' | 'assertive';

interface Announcement {
  id: string;
  message: string;
  priority: AriaLive;
  timestamp: number;
}

interface LiveRegionContextType {
  announce: (message: string, priority?: AriaLive) => void;
  clear: () => void;
}

const LiveRegionContext = createContext<LiveRegionContextType | undefined>(undefined);

export function useLiveRegion() {
  const context = useContext(LiveRegionContext);
  if (!context) {
    throw new Error('useLiveRegion must be used within LiveRegionProvider');
  }
  return context;
}

interface LiveRegionProviderProps {
  children: React.ReactNode;
  clearDelay?: number; // Delay before clearing announcements (ms)
}

export function LiveRegionProvider({ 
  children, 
  clearDelay = 5000 
}: LiveRegionProviderProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const announce = useCallback((message: string, priority: AriaLive = 'polite') => {
    const announcement: Announcement = {
      id: `announcement-${Date.now()}`,
      message,
      priority,
      timestamp: Date.now(),
    };

    setAnnouncements(prev => [...prev, announcement]);

    // Clear old announcements after delay
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setAnnouncements(prev => 
        prev.filter(a => Date.now() - a.timestamp < clearDelay)
      );
    }, clearDelay);
  }, [clearDelay]);

  const clear = useCallback(() => {
    setAnnouncements([]);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <LiveRegionContext.Provider value={{ announce, clear }}>
      {children}
      <LiveRegions announcements={announcements} />
    </LiveRegionContext.Provider>
  );
}

interface LiveRegionsProps {
  announcements: Announcement[];
}

function LiveRegions({ announcements }: LiveRegionsProps) {
  // Group announcements by priority
  const politeAnnouncements = announcements.filter(a => a.priority === 'polite');
  const assertiveAnnouncements = announcements.filter(a => a.priority === 'assertive');

  return (
    <>
      {/* Polite announcements - wait for user to finish current task */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeAnnouncements.map(announcement => (
          <div key={announcement.id}>{announcement.message}</div>
        ))}
      </div>

      {/* Assertive announcements - interrupt user immediately */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveAnnouncements.map(announcement => (
          <div key={announcement.id}>{announcement.message}</div>
        ))}
      </div>
    </>
  );
}

// Status message component for form feedback
interface StatusMessageProps {
  message?: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  role?: 'status' | 'alert';
  className?: string;
}

export function StatusMessage({ 
  message, 
  type = 'info',
  role = 'status',
  className 
}: StatusMessageProps) {
  if (!message) return null;

  const typeStyles = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  };

  return (
    <div
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className={cn(typeStyles[type], className)}
    >
      {message}
    </div>
  );
}

// Progress announcer for long-running operations
interface ProgressAnnouncerProps {
  value: number;
  max?: number;
  message?: string;
  announceInterval?: number; // Announce every N percent
}

export function ProgressAnnouncer({ 
  value, 
  max = 100,
  message = 'Progress',
  announceInterval = 10 
}: ProgressAnnouncerProps) {
  const { announce } = useLiveRegion();
  const lastAnnouncedRef = useRef<number>(0);

  useEffect(() => {
    const percentage = Math.round((value / max) * 100);
    const lastAnnounced = lastAnnouncedRef.current;

    // Announce at intervals or when complete
    if (
      percentage === 100 ||
      percentage - lastAnnounced >= announceInterval
    ) {
      const status = percentage === 100 
        ? `${message} complete`
        : `${message}: ${percentage}% complete`;
      
      announce(status, percentage === 100 ? 'assertive' : 'polite');
      lastAnnouncedRef.current = percentage;
    }
  }, [value, max, message, announceInterval, announce]);

  return null;
}