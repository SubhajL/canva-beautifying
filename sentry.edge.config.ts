// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Filter out certain errors
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_SENTRY_ENABLED) {
      console.error('Sentry Event (not sent in dev):', event);
      return null;
    }

    return event;
  },

  // Set environment
  environment: process.env.NODE_ENV,

  // Identify edge errors
  initialScope: {
    tags: {
      component: 'edge',
    },
  },
});