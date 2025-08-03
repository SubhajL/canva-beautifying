import { createClient } from '@/lib/supabase/server';
import * as Sentry from '@sentry/nextjs';

export type SecurityEventType = 
  | 'auth_failure'
  | 'auth_success'
  | 'suspicious_activity'
  | 'blocked_request'
  | 'rate_limit_exceeded'
  | 'invalid_token'
  | 'permission_denied'
  | 'data_breach_attempt'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'csrf_failure'
  | 'api_key_misuse'
  | 'file_access_denied';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  id?: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  ip?: string;
  userId?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export class SecurityLogger {
  private static instance: SecurityLogger;
  private eventQueue: SecurityEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    // Flush events every 30 seconds
    this.startPeriodicFlush();
  }

  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  // Log a security event
  async log(event: Omit<SecurityEvent, 'timestamp' | 'id'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
      id: crypto.randomUUID(),
    };

    // Add to queue for batch processing
    this.eventQueue.push(fullEvent);

    // Log critical events immediately
    if (event.severity === 'critical') {
      await this.flush();
      
      // Alert for critical events
      await this.alertCriticalEvent(fullEvent);
    }

    // Send to Sentry for monitoring
    if (event.severity === 'high' || event.severity === 'critical') {
      Sentry.captureMessage(`Security Event: ${event.type}`, {
        level: event.severity === 'critical' ? 'error' : 'warning',
        tags: {
          security_event: event.type,
          severity: event.severity,
        },
        extra: {
          ...event,
        },
      });
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Security]', event.severity.toUpperCase(), event.type, event);
    }
  }

  // Log authentication event
  async logAuth(
    success: boolean,
    email: string,
    ip?: string,
    method: 'password' | 'oauth' | 'magic_link' = 'password',
    errorCode?: string
  ): Promise<void> {
    await this.log({
      type: success ? 'auth_success' : 'auth_failure',
      severity: success ? 'low' : 'medium',
      ip,
      message: success 
        ? `Successful ${method} authentication for ${email}`
        : `Failed ${method} authentication for ${email}`,
      metadata: {
        email,
        method,
        errorCode,
      },
    });
  }

  // Log API access
  async logAPIAccess(
    path: string,
    method: string,
    statusCode: number,
    userId?: string,
    ip?: string,
    duration?: number
  ): Promise<void> {
    // Only log errors and slow requests
    if (statusCode >= 400 || (duration && duration > 5000)) {
      await this.log({
        type: statusCode === 403 ? 'permission_denied' : 'suspicious_activity',
        severity: statusCode >= 500 ? 'high' : 'medium',
        ip,
        userId,
        path,
        method,
        message: `API ${method} ${path} returned ${statusCode}`,
        metadata: {
          statusCode,
          duration,
        },
      });
    }
  }

  // Log file access attempts
  async logFileAccess(
    filename: string,
    action: 'read' | 'write' | 'delete',
    allowed: boolean,
    userId?: string,
    ip?: string
  ): Promise<void> {
    if (!allowed) {
      await this.log({
        type: 'file_access_denied',
        severity: 'high',
        ip,
        userId,
        message: `Unauthorized file ${action} attempt: ${filename}`,
        metadata: {
          filename,
          action,
        },
      });
    }
  }

  // Flush events to database
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const supabase = await createClient();
      
      const { error } = await supabase.from('security_events').insert(
        events.map(event => ({
          ip: event.ip,
          user_id: event.userId,
          event_type: event.type,
          severity: event.severity,
          path: event.path,
          method: event.method,
          user_agent: event.userAgent,
          metadata: {
            message: event.message,
            ...event.metadata,
          },
          created_at: event.timestamp.toISOString(),
        }))
      );

      if (error) {
        console.error('Failed to flush security events:', error);
        // Put events back in queue
        this.eventQueue.unshift(...events);
      }
    } catch (error) {
      console.error('Failed to flush security events:', error);
      // Put events back in queue
      this.eventQueue.unshift(...events);
    }
  }

  // Start periodic flush
  private startPeriodicFlush(): void {
    if (this.flushInterval) return;

    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000); // 30 seconds
  }

  // Stop periodic flush
  stopPeriodicFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // Alert critical events
  private async alertCriticalEvent(event: SecurityEvent): Promise<void> {
    // In production, this would send alerts via:
    // - Email
    // - Slack
    // - PagerDuty
    // - SMS
    
    console.error('[CRITICAL SECURITY EVENT]', event);
    
    // Send to monitoring service
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Critical Security Event: ${event.type}`,
            attachments: [{
              color: 'danger',
              fields: [
                { title: 'Type', value: event.type, short: true },
                { title: 'Severity', value: event.severity, short: true },
                { title: 'Message', value: event.message },
                { title: 'IP', value: event.ip || 'Unknown', short: true },
                { title: 'User ID', value: event.userId || 'Anonymous', short: true },
                { title: 'Path', value: event.path || 'N/A' },
                { title: 'Timestamp', value: event.timestamp.toISOString() },
              ],
            }],
          }),
        });
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }
  }

  // Get security metrics
  async getMetrics(
    timeRange: { start: Date; end: Date }
  ): Promise<{
    totalEvents: number;
    eventsByType: Record<SecurityEventType, number>;
    eventsBySeverity: Record<SecuritySeverity, number>;
    topIPs: Array<{ ip: string; count: number }>;
    topUsers: Array<{ userId: string; count: number }>;
  }> {
    try {
      const supabase = await createClient();
      
      const { data: events } = await supabase
        .from('security_events')
        .select('*')
        .gte('created_at', timeRange.start.toISOString())
        .lte('created_at', timeRange.end.toISOString());

      if (!events) {
        return {
          totalEvents: 0,
          eventsByType: {} as any,
          eventsBySeverity: {} as any,
          topIPs: [],
          topUsers: [],
        };
      }

      // Calculate metrics
      const eventsByType: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};
      const ipCounts: Record<string, number> = {};
      const userCounts: Record<string, number> = {};

      for (const event of events) {
        eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
        
        if (event.ip) {
          ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1;
        }
        
        if (event.user_id) {
          userCounts[event.user_id] = (userCounts[event.user_id] || 0) + 1;
        }
      }

      // Get top IPs and users
      const topIPs = Object.entries(ipCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }));

      const topUsers = Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }));

      return {
        totalEvents: events.length,
        eventsByType: eventsByType as any,
        eventsBySeverity: eventsBySeverity as any,
        topIPs,
        topUsers,
      };
    } catch (error) {
      console.error('Failed to get security metrics:', error);
      return {
        totalEvents: 0,
        eventsByType: {} as any,
        eventsBySeverity: {} as any,
        topIPs: [],
        topUsers: [],
      };
    }
  }
}

// Export singleton instance
export const securityLogger = SecurityLogger.getInstance();

// Middleware helper for Express/Next.js
export function securityLoggingMiddleware(
  req: any,
  res: any,
  next: () => void
): void {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function(data: any) {
    res.send = originalSend;
    
    const duration = Date.now() - startTime;
    const ip = req.headers['x-forwarded-for'] || req.ip;
    const userId = req.user?.id;
    
    // Log the request
    securityLogger.logAPIAccess(
      req.path,
      req.method,
      res.statusCode,
      userId,
      ip,
      duration
    );

    return res.send(data);
  };

  next();
}