import * as Sentry from '@sentry/nextjs';

export interface AlertRule {
  id: string;
  name: string;
  conditions: {
    errorRate?: number; // Percentage
    errorCount?: number; // Count in time window
    errorType?: string[]; // Specific error types
    timeWindow?: number; // Minutes
  };
  actions: {
    email?: string[];
    webhook?: string;
    slack?: string;
  };
  enabled: boolean;
}

// Default alert rules
export const defaultAlertRules: AlertRule[] = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    conditions: {
      errorRate: 5, // 5% error rate
      timeWindow: 5, // in 5 minutes
    },
    actions: {
      email: ['admin@beautifyai.com'],
    },
    enabled: true,
  },
  {
    id: 'critical-errors',
    name: 'Critical Errors',
    conditions: {
      errorType: ['DATABASE_ERROR', 'INTERNAL_ERROR'],
      errorCount: 1,
      timeWindow: 1,
    },
    actions: {
      email: ['admin@beautifyai.com'],
      slack: process.env.SLACK_WEBHOOK_URL,
    },
    enabled: true,
  },
  {
    id: 'ai-service-failures',
    name: 'AI Service Failures',
    conditions: {
      errorType: ['AI_SERVICE_ERROR'],
      errorCount: 10,
      timeWindow: 10,
    },
    actions: {
      email: ['admin@beautifyai.com'],
    },
    enabled: true,
  },
];

// Configure Sentry alerts
export function configureSentryAlerts() {
  // This would typically be done in Sentry dashboard
  // Here we're setting up some basic alert configurations
  
  if (process.env.NODE_ENV === 'production') {
    // Set up performance monitoring
    Sentry.configureScope((scope) => {
      scope.setTag('alert_enabled', 'true');
    });

    // Custom error filtering for alerts
    Sentry.addGlobalEventProcessor((event) => {
      // Check if error matches any alert rules
      const errorType = event.extra?.errorType || event.tags?.errorCode;
      
      if (errorType) {
        // Tag events that should trigger alerts
        const matchingRules = defaultAlertRules.filter(rule => 
          rule.enabled && 
          rule.conditions.errorType?.includes(errorType as string)
        );

        if (matchingRules.length > 0) {
          event.tags = {
            ...event.tags,
            alert_trigger: 'true',
            alert_rules: matchingRules.map(r => r.id).join(','),
          };
        }
      }

      return event;
    });
  }
}

// Send alert notification (placeholder - would integrate with real services)
export async function sendAlert(
  rule: AlertRule,
  error: Error,
  context?: Record<string, any>
) {
  const { actions } = rule;

  // Email alerts
  if (actions.email && actions.email.length > 0) {
    // In production, this would send actual emails
    console.log('Would send email alert to:', actions.email, {
      rule: rule.name,
      error: error.message,
      context,
    });
  }

  // Slack alerts
  if (actions.slack) {
    // In production, this would post to Slack
    console.log('Would send Slack alert:', {
      webhook: actions.slack,
      rule: rule.name,
      error: error.message,
    });
  }

  // Webhook alerts
  if (actions.webhook) {
    try {
      await fetch(actions.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rule: rule.name,
          error: {
            message: error.message,
            stack: error.stack,
            type: (error as any).code,
          },
          context,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (webhookError) {
      console.error('Failed to send webhook alert:', webhookError);
    }
  }
}