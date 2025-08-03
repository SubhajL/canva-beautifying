'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkipLink {
  id: string;
  label: string;
}

const defaultLinks: SkipLink[] = [
  { id: 'main-content', label: 'Skip to main content' },
  { id: 'main-navigation', label: 'Skip to navigation' },
];

interface SkipNavigationProps {
  links?: SkipLink[];
  className?: string;
}

export function SkipNavigation({ 
  links = defaultLinks,
  className 
}: SkipNavigationProps) {
  return (
    <div className={cn('relative', className)}>
      {links.map((link) => (
        <a
          key={link.id}
          href={`#${link.id}`}
          className={cn(
            'absolute left-0 top-0 z-[100] -translate-y-full',
            'bg-background text-foreground px-4 py-2 rounded-md',
            'focus:translate-y-0 focus:shadow-lg',
            'transition-transform duration-200',
            'sr-only focus:not-sr-only',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          )}
          onClick={(e) => {
            e.preventDefault();
            const target = document.getElementById(link.id);
            if (target) {
              target.scrollIntoView();
              target.focus({ preventScroll: true });
            }
          }}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

// Landmark component to mark main content areas
interface LandmarkProps {
  id: string;
  as?: keyof JSX.IntrinsicElements;
  role?: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
  tabIndex?: number;
}

export function Landmark({
  id,
  as: Component = 'div',
  role,
  label,
  children,
  className,
  tabIndex = -1,
}: LandmarkProps) {
  return (
    <Component
      id={id}
      role={role}
      aria-label={label}
      className={className}
      tabIndex={tabIndex}
    >
      {children}
    </Component>
  );
}