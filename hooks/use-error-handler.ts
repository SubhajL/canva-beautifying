import { useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { getUserFriendlyError, getRecoverySuggestions } from '@/lib/utils/error-messages';

export interface ErrorOptions {
  showToast?: boolean;
  logToSentry?: boolean;
  userMessage?: string;
  context?: Record<string, any>;
}

export function useErrorHandler() {
  const router = useRouter();

  const handleError = useCallback((
    error: Error | unknown,
    options: ErrorOptions = {}
  ) => {
    const {
      showToast = true,
      logToSentry = true,
      userMessage,
      context = {},
    } = options;

    // Extract error details
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const errorCode = (error as any)?.code || 'UNKNOWN_ERROR';
    const statusCode = (error as any)?.statusCode || 500;

    // Log to Sentry
    if (logToSentry) {
      Sentry.captureException(errorObj, {
        tags: {
          errorCode,
          statusCode: statusCode.toString(),
        },
        extra: context,
      });
    }

    // Get user-friendly error
    const friendlyError = getUserFriendlyError(errorCode);

    // Show toast notification
    if (showToast) {
      toast.error(userMessage || friendlyError.title, {
        description: friendlyError.message,
        action: friendlyError.actions?.[0] ? {
          label: friendlyError.actions[0].label,
          onClick: () => handleErrorAction(friendlyError.actions![0].action),
        } : undefined,
      });
    }

    // Return error details for component handling
    return {
      error: errorObj,
      friendlyError,
      suggestions: getRecoverySuggestions(errorCode),
    };
  }, [router]);

  const handleErrorAction = useCallback((action: string) => {
    switch (action) {
      case 'signin':
        router.push('/signin');
        break;
      case 'dashboard':
        router.push('/dashboard');
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'back':
        router.back();
        break;
      case 'support':
        router.push('/support');
        break;
      case 'status':
        window.open('https://status.beautifyai.com', '_blank');
        break;
      case 'formats':
        router.push('/help/supported-formats');
        break;
      default:
        // No action
        break;
    }
  }, [router]);

  return { handleError, handleErrorAction };
}

// Hook for API error handling
export function useApiError() {
  const { handleError } = useErrorHandler();

  const handleApiError = useCallback(async (response: Response) => {
    if (!response.ok) {
      try {
        const errorData = await response.json();
        const error = new Error(
          errorData.error?.message || 'API request failed'
        ) as any;
        error.code = errorData.error?.code;
        error.statusCode = response.status;
        error.details = errorData.error?.details;
        
        handleError(error, {
          context: {
            url: response.url,
            status: response.status,
            requestId: errorData.error?.requestId,
          },
        });
        
        throw error;
      } catch (parseError) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        handleError(error, {
          context: {
            url: response.url,
            status: response.status,
          },
        });
        throw error;
      }
    }
  }, [handleError]);

  return { handleApiError };
}