import { RateLimiter } from './validation';
import crypto from 'crypto';

export interface AuthAttempt {
  identifier: string;
  timestamp: number;
  success: boolean;
  method: 'password' | 'oauth' | 'magic-link';
  ip?: string;
  userAgent?: string;
}

export class AuthRateLimiter {
  private loginLimiter: RateLimiter;
  private passwordResetLimiter: RateLimiter;
  private signupLimiter: RateLimiter;
  private verificationLimiter: RateLimiter;
  
  // Track failed attempts for progressive delays
  private failedAttempts: Map<string, AuthAttempt[]> = new Map();
  
  // Blocked IPs/identifiers
  private blockedIdentifiers: Map<string, number> = new Map(); // identifier -> unblock timestamp
  
  constructor() {
    // Different limits for different auth operations
    this.loginLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes
    this.passwordResetLimiter = new RateLimiter(3, 60 * 60 * 1000); // 3 attempts per hour
    this.signupLimiter = new RateLimiter(3, 60 * 60 * 1000); // 3 signups per hour per IP
    this.verificationLimiter = new RateLimiter(10, 60 * 60 * 1000); // 10 verification attempts per hour
    
    // Clean up old data periodically
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
    }
  }

  // Check if login attempt is allowed
  async checkLoginAttempt(
    email: string,
    ip?: string
  ): Promise<{
    allowed: boolean;
    remainingAttempts?: number;
    blockDuration?: number;
    reason?: string;
  }> {
    const identifier = this.getIdentifier(email, ip);
    
    // Check if identifier is blocked
    if (this.isBlocked(identifier)) {
      const unblockTime = this.blockedIdentifiers.get(identifier)!;
      return {
        allowed: false,
        blockDuration: Math.ceil((unblockTime - Date.now()) / 1000),
        reason: 'Too many failed attempts. Account temporarily locked.',
      };
    }
    
    // Check rate limit
    if (!this.loginLimiter.isAllowed(identifier)) {
      return {
        allowed: false,
        remainingAttempts: 0,
        reason: 'Too many login attempts. Please try again later.',
      };
    }
    
    return {
      allowed: true,
      remainingAttempts: this.loginLimiter.getRemainingAttempts(identifier),
    };
  }

  // Record login attempt
  recordLoginAttempt(
    email: string,
    success: boolean,
    ip?: string,
    userAgent?: string
  ): void {
    const identifier = this.getIdentifier(email, ip);
    const attempt: AuthAttempt = {
      identifier,
      timestamp: Date.now(),
      success,
      method: 'password',
      ip,
      userAgent,
    };
    
    // Track failed attempts
    if (!success) {
      const attempts = this.failedAttempts.get(identifier) || [];
      attempts.push(attempt);
      
      // Keep only recent attempts (last 24 hours)
      const recentAttempts = attempts.filter(
        a => a.timestamp > Date.now() - 24 * 60 * 60 * 1000
      );
      
      this.failedAttempts.set(identifier, recentAttempts);
      
      // Check if we should block the identifier
      this.checkForSuspiciousActivity(identifier, recentAttempts);
    } else {
      // Clear failed attempts on successful login
      this.failedAttempts.delete(identifier);
      this.loginLimiter.reset(identifier);
    }
  }

  // Check password reset attempt
  async checkPasswordResetAttempt(
    email: string,
    ip?: string
  ): Promise<{
    allowed: boolean;
    remainingAttempts?: number;
    reason?: string;
  }> {
    const identifier = this.getIdentifier(email, ip);
    
    if (!this.passwordResetLimiter.isAllowed(identifier)) {
      return {
        allowed: false,
        remainingAttempts: 0,
        reason: 'Too many password reset requests. Please try again later.',
      };
    }
    
    return {
      allowed: true,
      remainingAttempts: this.passwordResetLimiter.getRemainingAttempts(identifier),
    };
  }

  // Check signup attempt
  async checkSignupAttempt(
    email: string,
    ip: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Rate limit by IP for signups
    if (!this.signupLimiter.isAllowed(ip)) {
      return {
        allowed: false,
        reason: 'Too many signup attempts from this IP. Please try again later.',
      };
    }
    
    // Also check by email to prevent spam
    if (!this.signupLimiter.isAllowed(email)) {
      return {
        allowed: false,
        reason: 'This email has been used for signup recently. Please try again later.',
      };
    }
    
    return { allowed: true };
  }

  // Check verification attempt (email/phone)
  async checkVerificationAttempt(
    identifier: string
  ): Promise<{
    allowed: boolean;
    remainingAttempts?: number;
    reason?: string;
  }> {
    if (!this.verificationLimiter.isAllowed(identifier)) {
      return {
        allowed: false,
        remainingAttempts: 0,
        reason: 'Too many verification attempts. Please try again later.',
      };
    }
    
    return {
      allowed: true,
      remainingAttempts: this.verificationLimiter.getRemainingAttempts(identifier),
    };
  }

  // Check for suspicious activity patterns
  private checkForSuspiciousActivity(
    identifier: string,
    attempts: AuthAttempt[]
  ): void {
    const recentAttempts = attempts.filter(
      a => a.timestamp > Date.now() - 60 * 60 * 1000 // Last hour
    );
    
    // Block if too many failed attempts in short time
    if (recentAttempts.length >= 10) {
      this.blockIdentifier(identifier, 24 * 60 * 60 * 1000); // Block for 24 hours
      return;
    }
    
    // Check for credential stuffing patterns
    const uniqueIPs = new Set(attempts.map(a => a.ip).filter(Boolean));
    const uniqueUserAgents = new Set(attempts.map(a => a.userAgent).filter(Boolean));
    
    // Suspicious if many attempts from different IPs/agents
    if (uniqueIPs.size > 5 || uniqueUserAgents.size > 5) {
      this.blockIdentifier(identifier, 6 * 60 * 60 * 1000); // Block for 6 hours
      return;
    }
    
    // Progressive delays based on failed attempts
    const failedCount = recentAttempts.filter(a => !a.success).length;
    if (failedCount >= 5) {
      this.blockIdentifier(identifier, Math.min(failedCount * 5 * 60 * 1000, 60 * 60 * 1000));
    }
  }

  // Block an identifier
  blockIdentifier(identifier: string, duration: number): void {
    this.blockedIdentifiers.set(identifier, Date.now() + duration);
  }

  // Check if identifier is blocked
  isBlocked(identifier: string): boolean {
    const unblockTime = this.blockedIdentifiers.get(identifier);
    if (!unblockTime) return false;
    
    if (unblockTime < Date.now()) {
      this.blockedIdentifiers.delete(identifier);
      return false;
    }
    
    return true;
  }

  // Get identifier for rate limiting
  private getIdentifier(email: string, ip?: string): string {
    // Use combination of email and IP for better security
    return crypto
      .createHash('sha256')
      .update(`${email}:${ip || 'unknown'}`)
      .digest('hex');
  }

  // Clean up old data
  private cleanup(): void {
    const now = Date.now();
    
    // Clean up expired blocks
    for (const [identifier, unblockTime] of this.blockedIdentifiers.entries()) {
      if (unblockTime < now) {
        this.blockedIdentifiers.delete(identifier);
      }
    }
    
    // Clean up old failed attempts
    for (const [identifier, attempts] of this.failedAttempts.entries()) {
      const recentAttempts = attempts.filter(
        a => a.timestamp > now - 24 * 60 * 60 * 1000
      );
      
      if (recentAttempts.length === 0) {
        this.failedAttempts.delete(identifier);
      } else {
        this.failedAttempts.set(identifier, recentAttempts);
      }
    }
  }

  // Get auth attempt statistics
  getStatistics(): {
    totalFailedAttempts: number;
    blockedIdentifiers: number;
    suspiciousPatterns: string[];
  } {
    let totalFailedAttempts = 0;
    const suspiciousPatterns: string[] = [];
    
    for (const attempts of this.failedAttempts.values()) {
      totalFailedAttempts += attempts.filter(a => !a.success).length;
    }
    
    // Detect patterns
    const ipCounts = new Map<string, number>();
    for (const attempts of this.failedAttempts.values()) {
      for (const attempt of attempts) {
        if (attempt.ip) {
          ipCounts.set(attempt.ip, (ipCounts.get(attempt.ip) || 0) + 1);
        }
      }
    }
    
    // Flag IPs with many failed attempts
    for (const [ip, count] of ipCounts.entries()) {
      if (count > 20) {
        suspiciousPatterns.push(`High failure rate from IP: ${ip}`);
      }
    }
    
    return {
      totalFailedAttempts,
      blockedIdentifiers: this.blockedIdentifiers.size,
      suspiciousPatterns,
    };
  }
}

// Global instance
export const authRateLimiter = new AuthRateLimiter();