import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Trap focus within a container element
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  isActive: boolean = true,
  returnFocus: boolean = true
) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    
    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the container
    const getFocusableElements = () => {
      const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',');

      return Array.from(
        container.querySelectorAll<HTMLElement>(selector)
      ).filter(el => {
        // Filter out elements that are not visible
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    };

    // Focus the first focusable element
    const focusFirstElement = () => {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        elements[0].focus();
      }
    };

    // Handle tab key navigation
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      // Tab backwards from first element - focus last
      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
      // Tab forward from last element - focus first
      else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    // Handle escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && container.dataset.closeable !== 'false') {
        // Trigger close event if container has a close handler
        const closeEvent = new CustomEvent('close');
        container.dispatchEvent(closeEvent);
      }
    };

    // Set up event listeners
    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('keydown', handleEscape);

    // Focus first element after a short delay
    setTimeout(focusFirstElement, 50);

    // Cleanup
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('keydown', handleEscape);

      // Return focus to previous element
      if (returnFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, containerRef, returnFocus]);
}

/**
 * Manage focus on route changes
 */
export function useRouteFocus(
  options: {
    focusTarget?: string; // CSS selector or element ID
    announceRoute?: boolean;
    announceMessage?: (pathname: string) => string;
  } = {}
) {
  const pathname = usePathname();
  const { 
    focusTarget = '#main-content',
    announceRoute = true,
    announceMessage = (path) => `Navigated to ${path}` 
  } = options;

  useEffect(() => {
    // Focus the target element
    const target = focusTarget.startsWith('#') 
      ? document.getElementById(focusTarget.slice(1))
      : document.querySelector(focusTarget);

    if (target instanceof HTMLElement) {
      // Set tabindex if not focusable
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus();
    }

    // Announce route change to screen readers
    if (announceRoute) {
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = announceMessage(pathname);
      
      document.body.appendChild(announcement);
      
      // Remove after announcement
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  }, [pathname, focusTarget, announceRoute, announceMessage]);
}

/**
 * Skip to specific element when activated
 */
export function skipToElement(elementId: string) {
  const element = document.getElementById(elementId);
  if (element) {
    // Ensure element is focusable
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '-1');
    }
    
    // Scroll and focus
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element.focus({ preventScroll: true });
    
    // Announce to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = `Skipped to ${element.getAttribute('aria-label') || elementId}`;
    
    document.body.appendChild(announcement);
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
}

/**
 * Restore focus to a previous element
 */
export function useFocusRestore() {
  const previousFocus = useRef<HTMLElement | null>(null);

  const storeFocus = () => {
    previousFocus.current = document.activeElement as HTMLElement;
  };

  const restoreFocus = () => {
    if (previousFocus.current && previousFocus.current !== document.body) {
      previousFocus.current.focus();
    }
  };

  return { storeFocus, restoreFocus };
}

/**
 * Lock body scroll when modal is open
 */
export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    
    // Calculate scrollbar width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // Lock scroll
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isLocked]);
}