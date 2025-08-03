import { useEffect, useState } from 'react';

// Breakpoint values matching Tailwind defaults
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1400,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * Hook to get current breakpoint
 */
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('sm');
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const width = window.innerWidth;
      setWindowSize({ width, height: window.innerHeight });

      if (width >= breakpoints['2xl']) {
        setBreakpoint('2xl');
      } else if (width >= breakpoints.xl) {
        setBreakpoint('xl');
      } else if (width >= breakpoints.lg) {
        setBreakpoint('lg');
      } else if (width >= breakpoints.md) {
        setBreakpoint('md');
      } else {
        setBreakpoint('sm');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { breakpoint, windowSize, isMobile: windowSize.width < breakpoints.md };
}

/**
 * Hook to detect if user is on a touch device
 */
export function useIsTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is a non-standard property
        navigator.msMaxTouchPoints > 0
      );
    };

    checkTouchDevice();
  }, []);

  return isTouchDevice;
}

/**
 * Hook to detect device orientation
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOrientationChange = () => {
      setOrientation(
        window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
      );
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return orientation;
}

/**
 * Utility to generate responsive class names
 */
export function responsiveClass<T extends string>(
  classes: Partial<Record<Breakpoint | 'base', T>>
): string {
  const classList: string[] = [];

  if (classes.base) {
    classList.push(classes.base);
  }

  Object.entries(classes).forEach(([breakpoint, className]) => {
    if (breakpoint !== 'base' && className) {
      classList.push(`${breakpoint}:${className}`);
    }
  });

  return classList.join(' ');
}

/**
 * Get safe area insets for devices with notches
 */
export function getSafeAreaInsets() {
  if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 };

  const styles = window.getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(styles.getPropertyValue('--sat') || '0'),
    bottom: parseInt(styles.getPropertyValue('--sab') || '0'),
    left: parseInt(styles.getPropertyValue('--sal') || '0'),
    right: parseInt(styles.getPropertyValue('--sar') || '0'),
  };
}

/**
 * Mobile-first responsive spacing utility
 */
export const spacing = {
  container: responsiveClass({
    base: 'px-4',
    sm: 'px-6',
    lg: 'px-8',
    xl: 'px-12',
  }),
  section: responsiveClass({
    base: 'py-12',
    md: 'py-16',
    lg: 'py-24',
  }),
  stack: responsiveClass({
    base: 'space-y-4',
    md: 'space-y-6',
    lg: 'space-y-8',
  }),
};