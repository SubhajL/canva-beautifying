'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Upload, History, User, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/lib/utils/responsive';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: Home },
  { label: 'Upload', href: '/upload', icon: Upload },
  { label: 'Enhance', href: '/enhance', icon: Plus },
  { label: 'History', href: '/history', icon: History },
  { label: 'Profile', href: '/profile', icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { isMobile } = useBreakpoint();

  // Only show on mobile devices
  if (!isMobile) return null;

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the nav */}
      <div className="h-16 md:hidden" />
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden safe-bottom">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center py-2 px-1 transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'active:scale-95 transition-transform',
                  isActive && 'text-primary'
                )}
              >
                <Icon 
                  className={cn(
                    'h-5 w-5 mb-1 transition-colors',
                    isActive && 'text-primary'
                  )} 
                />
                <span className={cn(
                  'text-xs font-medium',
                  isActive && 'text-primary'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

// CSS utility class for safe area bottom padding
// Add this to your global CSS:
// .safe-bottom {
//   padding-bottom: env(safe-area-inset-bottom);
// }