import { ErrorTypes } from './api-error-handler';

export interface UserFriendlyError {
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: string;
  }>;
  recoverable: boolean;
}

export function getUserFriendlyError(
  errorCode: string,
  _details?: any
): UserFriendlyError {
  switch (errorCode) {
    case ErrorTypes.VALIDATION_ERROR:
      return {
        title: 'Invalid Input',
        message: 'Please check your input and try again.',
        actions: [
          { label: 'Review Input', action: 'review' },
        ],
        recoverable: true,
      };

    case ErrorTypes.AUTHENTICATION_ERROR:
      return {
        title: 'Authentication Required',
        message: 'Please sign in to continue.',
        actions: [
          { label: 'Sign In', action: 'signin' },
        ],
        recoverable: true,
      };

    case ErrorTypes.AUTHORIZATION_ERROR:
      return {
        title: 'Access Denied',
        message: 'You don\'t have permission to perform this action.',
        actions: [
          { label: 'Go Back', action: 'back' },
          { label: 'Contact Support', action: 'support' },
        ],
        recoverable: true,
      };

    case ErrorTypes.NOT_FOUND:
      return {
        title: 'Not Found',
        message: 'The requested resource could not be found.',
        actions: [
          { label: 'Go to Dashboard', action: 'dashboard' },
        ],
        recoverable: true,
      };

    case ErrorTypes.CONFLICT:
      return {
        title: 'Conflict',
        message: 'This action conflicts with the current state. Please refresh and try again.',
        actions: [
          { label: 'Refresh', action: 'refresh' },
        ],
        recoverable: true,
      };

    case ErrorTypes.RATE_LIMIT:
      return {
        title: 'Too Many Requests',
        message: 'You\'ve made too many requests. Please wait a moment before trying again.',
        actions: [
          { label: 'Wait', action: 'wait' },
        ],
        recoverable: true,
      };

    case ErrorTypes.FILE_PROCESSING_ERROR:
      return {
        title: 'File Processing Error',
        message: 'We couldn\'t process your file. Please check the format and try again.',
        actions: [
          { label: 'Try Different File', action: 'retry' },
          { label: 'View Supported Formats', action: 'formats' },
        ],
        recoverable: true,
      };

    case ErrorTypes.AI_SERVICE_ERROR:
      return {
        title: 'Service Temporarily Unavailable',
        message: 'Our AI service is temporarily unavailable. Please try again in a few moments.',
        actions: [
          { label: 'Retry', action: 'retry' },
          { label: 'Use Alternative', action: 'alternative' },
        ],
        recoverable: true,
      };

    case ErrorTypes.DATABASE_ERROR:
      return {
        title: 'System Error',
        message: 'We encountered a system error. Our team has been notified.',
        actions: [
          { label: 'Try Again', action: 'retry' },
          { label: 'Contact Support', action: 'support' },
        ],
        recoverable: false,
      };

    case ErrorTypes.EXTERNAL_SERVICE_ERROR:
      return {
        title: 'External Service Error',
        message: 'One of our services is experiencing issues. Please try again later.',
        actions: [
          { label: 'Retry', action: 'retry' },
          { label: 'Check Status', action: 'status' },
        ],
        recoverable: true,
      };

    default:
      return {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred. Please try again or contact support.',
        actions: [
          { label: 'Try Again', action: 'retry' },
          { label: 'Contact Support', action: 'support' },
        ],
        recoverable: false,
      };
  }
}

// Error recovery suggestions based on error type
export function getRecoverySuggestions(errorCode: string): string[] {
  switch (errorCode) {
    case ErrorTypes.VALIDATION_ERROR:
      return [
        'Check that all required fields are filled',
        'Ensure file formats are supported',
        'Verify that values are within allowed ranges',
      ];

    case ErrorTypes.AUTHENTICATION_ERROR:
      return [
        'Sign in to your account',
        'Check if your session has expired',
        'Try signing out and back in',
      ];

    case ErrorTypes.RATE_LIMIT:
      return [
        'Wait a few minutes before trying again',
        'Consider upgrading your plan for higher limits',
        'Spread out your requests over time',
      ];

    case ErrorTypes.FILE_PROCESSING_ERROR:
      return [
        'Check that your file is not corrupted',
        'Ensure the file size is within limits',
        'Try converting to a different format',
        'Remove any password protection from PDFs',
      ];

    case ErrorTypes.AI_SERVICE_ERROR:
      return [
        'Wait a few minutes and try again',
        'Try using a different AI model if available',
        'Reduce the complexity of your request',
      ];

    default:
      return [
        'Refresh the page and try again',
        'Check your internet connection',
        'Contact support if the issue persists',
      ];
  }
}