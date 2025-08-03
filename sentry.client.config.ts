// This file configures the initialization of Sentry on the client side
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  
  // Replay settings
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out certain errors
  beforeSend(event, hint) {
    // Filter out network errors that are expected
    if (event.exception?.values?.[0]?.type === 'NetworkError') {
      return null;
    }
    
    // Filter out errors from browser extensions
    if (event.exception?.values?.[0]?.value?.includes('extension://')) {
      return null;
    }

    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SENTRY_ENABLED) {
      console.error('Sentry Event (not sent in dev):', event);
      return null;
    }

    return event;
  },

  // Set environment
  environment: process.env.NODE_ENV,

  // Identify users
  initialScope: {
    tags: {
      component: 'client',
    },
  },
});