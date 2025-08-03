'use client';

import { useAuth } from '@/contexts/auth-context';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar, Upload } from 'lucide-react';
import Link from 'next/link';

export function DashboardHeader() {
  const { user } = useAuth();
  const now = new Date();
  const greeting = getGreeting();

  function getGreeting() {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting}, {firstName}!
        </h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{format(now, 'EEEE, MMMM d, yyyy')}</span>
        </div>
      </div>
      
      <Link href="/upload">
        <Button size="lg" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </Link>
    </div>
  );
}