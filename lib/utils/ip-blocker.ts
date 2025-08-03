import { createClient } from '@/lib/supabase/server';

export interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  metadata?: {
    failedAttempts?: number;
    lastAttempt?: Date;
    userAgent?: string;
    path?: string;
  };
}

export class IPBlocker {
  private blockedIPs: Map<string, BlockedIP> = new Map();
  private suspiciousActivity: Map<string, number> = new Map(); // IP -> score
  
  // Thresholds for blocking
  private readonly SUSPICIOUS_SCORE_THRESHOLD = 100;
  private readonly BLOCK_DURATION_HOURS = 24;
  
  // Scoring for different activities
  private readonly ACTIVITY_SCORES = {
    failedLogin: 10,
    rapidRequests: 5,
    invalidEndpoint: 15,
    sqlInjectionAttempt: 50,
    xssAttempt: 50,
    pathTraversal: 50,
    bruteForce: 30,
    unauthorized: 20,
  };

  constructor() {
    // Load blocked IPs from database on startup
    this.loadBlockedIPs();
    
    // Clean up expired blocks periodically
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanupExpiredBlocks(), 60 * 60 * 1000); // Every hour
    }
  }

  // Check if IP is blocked
  isBlocked(ip: string): BlockedIP | null {
    const blocked = this.blockedIPs.get(ip);
    
    if (!blocked) return null;
    
    // Check if block has expired
    if (blocked.expiresAt && blocked.expiresAt < new Date()) {
      this.unblockIP(ip);
      return null;
    }
    
    return blocked;
  }

  // Block an IP
  async blockIP(
    ip: string,
    reason: string,
    durationHours: number = this.BLOCK_DURATION_HOURS,
    metadata?: BlockedIP['metadata']
  ): Promise<void> {
    const blockedAt = new Date();
    const expiresAt = new Date(blockedAt.getTime() + durationHours * 60 * 60 * 1000);
    
    const blockInfo: BlockedIP = {
      ip,
      reason,
      blockedAt,
      expiresAt,
      metadata,
    };
    
    this.blockedIPs.set(ip, blockInfo);
    
    // Persist to database
    try {
      const supabase = await createClient();
      await supabase.from('blocked_ips').insert({
        ip,
        reason,
        blocked_at: blockedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        metadata,
      });
    } catch (error) {
      console.error('Failed to persist IP block:', error);
    }
    
    // Log the blocking action
    console.log(`Blocked IP ${ip} for ${reason}`);
  }

  // Unblock an IP
  async unblockIP(ip: string): Promise<void> {
    this.blockedIPs.delete(ip);
    this.suspiciousActivity.delete(ip);
    
    // Remove from database
    try {
      const supabase = await createClient();
      await supabase.from('blocked_ips').delete().eq('ip', ip);
    } catch (error) {
      console.error('Failed to remove IP block:', error);
    }
  }

  // Record suspicious activity
  recordSuspiciousActivity(
    ip: string,
    activityType: keyof typeof this.ACTIVITY_SCORES,
    metadata?: any
  ): void {
    const score = this.ACTIVITY_SCORES[activityType];
    const currentScore = this.suspiciousActivity.get(ip) || 0;
    const newScore = currentScore + score;
    
    this.suspiciousActivity.set(ip, newScore);
    
    // Check if IP should be blocked
    if (newScore >= this.SUSPICIOUS_SCORE_THRESHOLD) {
      this.blockIP(
        ip,
        `Suspicious activity detected: ${activityType}`,
        this.BLOCK_DURATION_HOURS,
        metadata
      );
    }
    
    // Log suspicious activity
    this.logSecurityEvent(ip, activityType, metadata);
  }

  // Detect common attack patterns
  detectAttackPattern(
    ip: string,
    path: string,
    params: Record<string, any>,
    headers: Record<string, string>
  ): void {
    // SQL Injection patterns
    const sqlInjectionPatterns = [
      /(\b(union|select|insert|update|delete|drop|create)\b.*\b(from|where|table)\b)/i,
      /(';|";|`|--|\/\*|\*\/)/,
      /(\bor\b.*=.*\bor\b|\band\b.*=.*\band\b)/i,
    ];
    
    // XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe|<object|<embed/gi,
    ];
    
    // Path traversal patterns
    const pathTraversalPatterns = [
      /\.\.(\/|\\)/,
      /\/etc\/passwd/,
      /\/windows\/system32/,
    ];
    
    // Check all input sources
    const allInputs = [
      path,
      ...Object.values(params),
      ...Object.values(headers),
    ].join(' ');
    
    // Check for SQL injection
    for (const pattern of sqlInjectionPatterns) {
      if (pattern.test(allInputs)) {
        this.recordSuspiciousActivity(ip, 'sqlInjectionAttempt', {
          path,
          pattern: pattern.toString(),
        });
        return;
      }
    }
    
    // Check for XSS
    for (const pattern of xssPatterns) {
      if (pattern.test(allInputs)) {
        this.recordSuspiciousActivity(ip, 'xssAttempt', {
          path,
          pattern: pattern.toString(),
        });
        return;
      }
    }
    
    // Check for path traversal
    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(path)) {
        this.recordSuspiciousActivity(ip, 'pathTraversal', {
          path,
          pattern: pattern.toString(),
        });
        return;
      }
    }
  }

  // Get blocked IP statistics
  getStatistics(): {
    totalBlocked: number;
    suspiciousIPs: number;
    topReasons: Record<string, number>;
  } {
    const topReasons: Record<string, number> = {};
    
    for (const blocked of this.blockedIPs.values()) {
      topReasons[blocked.reason] = (topReasons[blocked.reason] || 0) + 1;
    }
    
    return {
      totalBlocked: this.blockedIPs.size,
      suspiciousIPs: this.suspiciousActivity.size,
      topReasons,
    };
  }

  // Clean up expired blocks
  private cleanupExpiredBlocks(): void {
    const now = new Date();
    
    for (const [ip, blocked] of this.blockedIPs.entries()) {
      if (blocked.expiresAt && blocked.expiresAt < now) {
        this.unblockIP(ip);
      }
    }
    
    // Decay suspicious activity scores
    for (const [ip, score] of this.suspiciousActivity.entries()) {
      const decayedScore = Math.max(0, score - 10); // Decay by 10 points per hour
      if (decayedScore === 0) {
        this.suspiciousActivity.delete(ip);
      } else {
        this.suspiciousActivity.set(ip, decayedScore);
      }
    }
  }

  // Load blocked IPs from database
  private async loadBlockedIPs(): Promise<void> {
    try {
      const supabase = await createClient();
      const { data: blockedIPs } = await supabase
        .from('blocked_ips')
        .select('*')
        .gt('expires_at', new Date().toISOString());
      
      if (blockedIPs) {
        for (const record of blockedIPs) {
          this.blockedIPs.set(record.ip, {
            ip: record.ip,
            reason: record.reason,
            blockedAt: new Date(record.blocked_at),
            expiresAt: record.expires_at ? new Date(record.expires_at) : undefined,
            metadata: record.metadata,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load blocked IPs:', error);
    }
  }

  // Log security events
  private async logSecurityEvent(
    ip: string,
    eventType: string,
    metadata?: any
  ): Promise<void> {
    try {
      const supabase = await createClient();
      await supabase.from('security_events').insert({
        ip,
        event_type: eventType,
        metadata,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // Get IP reputation from external services (placeholder)
  async checkIPReputation(ip: string): Promise<{
    isKnownThreat: boolean;
    threatLevel: 'low' | 'medium' | 'high';
    reason?: string;
  }> {
    // In production, integrate with services like:
    // - AbuseIPDB
    // - IPQualityScore
    // - Cloudflare
    
    // For now, return a basic check
    const privateIPRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
    ];
    
    // Don't block private IPs
    for (const range of privateIPRanges) {
      if (range.test(ip)) {
        return { isKnownThreat: false, threatLevel: 'low' };
      }
    }
    
    return { isKnownThreat: false, threatLevel: 'low' };
  }
}

// Global instance
export const ipBlocker = new IPBlocker();

// Middleware helper
export async function checkIPMiddleware(
  ip: string,
  path: string,
  params?: Record<string, any>,
  headers?: Record<string, string>
): Promise<{ allowed: boolean; reason?: string }> {
  // Check if IP is blocked
  const blocked = ipBlocker.isBlocked(ip);
  if (blocked) {
    return {
      allowed: false,
      reason: `IP blocked: ${blocked.reason}`,
    };
  }
  
  // Check for attack patterns if params/headers provided
  if (params || headers) {
    ipBlocker.detectAttackPattern(
      ip,
      path,
      params || {},
      headers || {}
    );
  }
  
  // Check IP reputation
  const reputation = await ipBlocker.checkIPReputation(ip);
  if (reputation.isKnownThreat && reputation.threatLevel === 'high') {
    ipBlocker.blockIP(ip, reputation.reason || 'Known threat IP');
    return {
      allowed: false,
      reason: 'IP identified as threat',
    };
  }
  
  return { allowed: true };
}