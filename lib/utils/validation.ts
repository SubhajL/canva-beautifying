import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';
import path from 'path';

// Common validation schemas
export const emailSchema = z.string().email().transform(val => val.toLowerCase().trim());

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

export const phoneSchema = z.string()
  .refine(val => validator.isMobilePhone(val, 'any'), 'Invalid phone number');

export const urlSchema = z.string()
  .refine(val => validator.isURL(val, { protocols: ['http', 'https'] }), 'Invalid URL');

// Input sanitization functions
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

export function sanitizeText(text: string): string {
  return validator.escape(text.trim());
}

export function sanitizeFilename(filename: string): string {
  // Remove any path traversal attempts
  const cleaned = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
  
  // Remove special characters except dots and hyphens
  return cleaned.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function sanitizeJSON(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeJSON);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      sanitized[sanitizedKey] = sanitizeJSON(value);
    }
    return sanitized;
  }
  
  return obj;
}

// SQL injection prevention
export function sanitizeSQLIdentifier(identifier: string): string {
  // Only allow alphanumeric characters and underscores
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
}

// XSS prevention
export function preventXSS(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return input.replace(/[&<>"'\/]/g, (s) => map[s]);
}

// Path traversal prevention
export function isPathSafe(filePath: string, allowedBasePath: string): boolean {
  const normalizedPath = path.resolve(filePath);
  const normalizedBase = path.resolve(allowedBasePath);
  
  return normalizedPath.startsWith(normalizedBase);
}

// File upload validation
export interface FileValidationOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string } {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    allowedExtensions = [],
  } = options;

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`,
    };
  }

  // Check file type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  // Check file extension
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension .${extension} is not allowed`,
      };
    }
  }

  // Additional security checks
  const filename = sanitizeFilename(file.name);
  if (filename !== file.name) {
    return {
      valid: false,
      error: 'Filename contains invalid characters',
    };
  }

  return { valid: true };
}

// Rate limiting helper
export class RateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(
    private maxAttempts: number,
    private windowMs: number
  ) {}

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record || record.resetTime < now) {
      this.attempts.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  getRemainingAttempts(identifier: string): number {
    const record = this.attempts.get(identifier);
    if (!record || record.resetTime < Date.now()) {
      return this.maxAttempts;
    }
    return Math.max(0, this.maxAttempts - record.count);
  }
}

// Credit card masking
export function maskCreditCard(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 8) return '****';
  
  const firstFour = cleaned.substring(0, 4);
  const lastFour = cleaned.substring(cleaned.length - 4);
  
  return `${firstFour} **** **** ${lastFour}`;
}

// Email masking
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***@***.***';
  
  const maskedLocal = localPart.length > 2
    ? localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1]
    : '*'.repeat(localPart.length);
    
  return `${maskedLocal}@${domain}`;
}

// Input validation middleware
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (input: unknown): Promise<{ valid: true; data: T } | { valid: false; errors: z.ZodError }> => {
    try {
      const data = await schema.parseAsync(input);
      return { valid: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error };
      }
      throw error;
    }
  };
}

// Validate input and throw if invalid
export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}