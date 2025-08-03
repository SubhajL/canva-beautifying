import { encryptData, decryptData } from './encryption';
import crypto from 'crypto';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  service: string;
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  permissions: string[];
  metadata?: Record<string, any>;
}

export interface EncryptedApiKey {
  id: string;
  name: string;
  encryptedKey: string;
  service: string;
  keyHash: string;
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  permissions: string[];
  metadata?: Record<string, any>;
}

export class ApiKeyManager {
  private encryptionKey: string;

  constructor(encryptionKey?: string) {
    this.encryptionKey = encryptionKey || process.env.API_KEY_ENCRYPTION_SECRET || '';
    if (!this.encryptionKey) {
      throw new Error('API_KEY_ENCRYPTION_SECRET environment variable is required');
    }
  }

  // Generate a new API key
  generateApiKey(prefix = 'sk'): string {
    const randomBytes = crypto.randomBytes(32);
    const key = randomBytes.toString('base64url');
    return `${prefix}_${key}`;
  }

  // Hash API key for storage/lookup
  hashApiKey(apiKey: string): string {
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
  }

  // Encrypt API key for storage
  encryptApiKey(apiKey: ApiKey): EncryptedApiKey {
    const encryptedKey = encryptData(apiKey.key, this.encryptionKey);
    const keyHash = this.hashApiKey(apiKey.key);

    return {
      ...apiKey,
      encryptedKey,
      keyHash,
      key: undefined as any, // Remove plain key
    };
  }

  // Decrypt API key
  decryptApiKey(encryptedApiKey: EncryptedApiKey): ApiKey {
    const key = decryptData(encryptedApiKey.encryptedKey, this.encryptionKey);

    return {
      ...encryptedApiKey,
      key,
      encryptedKey: undefined as any,
      keyHash: undefined as any,
    };
  }

  // Validate API key format
  validateApiKeyFormat(apiKey: string): boolean {
    const pattern = /^[a-zA-Z]+_[a-zA-Z0-9_-]{32,}$/;
    return pattern.test(apiKey);
  }

  // Check if API key is expired
  isApiKeyExpired(apiKey: EncryptedApiKey): boolean {
    if (!apiKey.expiresAt) return false;
    return new Date() > apiKey.expiresAt;
  }

  // Rotate API key
  rotateApiKey(oldApiKey: ApiKey): ApiKey {
    return {
      ...oldApiKey,
      key: this.generateApiKey(oldApiKey.key.split('_')[0]),
      createdAt: new Date(),
      lastUsed: undefined,
    };
  }

  // Create masked version of API key for display
  maskApiKey(apiKey: string): string {
    if (apiKey.length < 8) return '***';
    const prefix = apiKey.substring(0, 7);
    const suffix = apiKey.substring(apiKey.length - 4);
    return `${prefix}...${suffix}`;
  }

  // Verify API key against hash
  verifyApiKey(apiKey: string, keyHash: string): boolean {
    return this.hashApiKey(apiKey) === keyHash;
  }

  // Generate API key metadata
  generateApiKeyMetadata(
    name: string,
    service: string,
    permissions: string[] = [],
    expiresInDays?: number
  ): Omit<ApiKey, 'key'> {
    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    return {
      id: crypto.randomUUID(),
      name,
      service,
      createdAt: now,
      permissions,
      expiresAt,
    };
  }
}

// Service-specific API key managers
export class AIServiceApiKeyManager extends ApiKeyManager {
  private services = ['openai', 'anthropic', 'google', 'perplexity', 'openrouter'];

  validateServiceKey(service: string, apiKey: string): boolean {
    const validations: Record<string, RegExp> = {
      openai: /^sk-[a-zA-Z0-9]{48}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9-]{95}$/,
      google: /^[a-zA-Z0-9_-]{39}$/,
      perplexity: /^pplx-[a-zA-Z0-9]{48}$/,
      openrouter: /^sk-or-[a-zA-Z0-9]{48}$/,
    };

    const pattern = validations[service];
    return pattern ? pattern.test(apiKey) : this.validateApiKeyFormat(apiKey);
  }

  getServiceFromKey(apiKey: string): string | null {
    if (apiKey.startsWith('sk-ant-')) return 'anthropic';
    if (apiKey.startsWith('sk-')) return 'openai';
    if (apiKey.startsWith('pplx-')) return 'perplexity';
    if (apiKey.startsWith('sk-or-')) return 'openrouter';
    if (apiKey.match(/^[a-zA-Z0-9_-]{39}$/)) return 'google';
    return null;
  }
}

// Environment variable API key loader
export class EnvApiKeyLoader {
  private keyManager: ApiKeyManager;

  constructor(keyManager: ApiKeyManager) {
    this.keyManager = keyManager;
  }

  loadFromEnv(): Map<string, EncryptedApiKey> {
    const apiKeys = new Map<string, EncryptedApiKey>();
    const envKeys = {
      OPENAI_API_KEY: 'openai',
      ANTHROPIC_API_KEY: 'anthropic',
      GOOGLE_API_KEY: 'google',
      PERPLEXITY_API_KEY: 'perplexity',
      OPENROUTER_API_KEY: 'openrouter',
      RESEND_API_KEY: 'resend',
      STRIPE_SECRET_KEY: 'stripe',
    };

    for (const [envVar, service] of Object.entries(envKeys)) {
      const apiKey = process.env[envVar];
      if (apiKey) {
        const keyData: ApiKey = {
          id: crypto.randomUUID(),
          name: `${service}_default`,
          key: apiKey,
          service,
          createdAt: new Date(),
          permissions: ['read', 'write'],
        };

        const encryptedKey = this.keyManager.encryptApiKey(keyData);
        apiKeys.set(service, encryptedKey);
      }
    }

    return apiKeys;
  }
}

// API key rotation scheduler
export class ApiKeyRotationScheduler {
  private keyManager: ApiKeyManager;
  private rotationIntervals: Map<string, number> = new Map();

  constructor(keyManager: ApiKeyManager) {
    this.keyManager = keyManager;
  }

  scheduleRotation(
    apiKeyId: string,
    intervalDays: number,
    _onRotate: (newKey: ApiKey) => Promise<void>
  ): void {
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    
    const interval = setInterval(async () => {
      try {
        // This would fetch the current key from storage
        // For now, we'll just demonstrate the pattern
        console.log(`Rotating API key ${apiKeyId}`);
        // const currentKey = await fetchApiKey(apiKeyId);
        // const newKey = this.keyManager.rotateApiKey(currentKey);
        // await onRotate(newKey);
      } catch (error) {
        console.error(`Failed to rotate API key ${apiKeyId}:`, error);
      }
    }, intervalMs);

    this.rotationIntervals.set(apiKeyId, interval as any);
  }

  cancelRotation(apiKeyId: string): void {
    const interval = this.rotationIntervals.get(apiKeyId);
    if (interval) {
      clearInterval(interval);
      this.rotationIntervals.delete(apiKeyId);
    }
  }

  cancelAllRotations(): void {
    for (const interval of this.rotationIntervals.values()) {
      clearInterval(interval);
    }
    this.rotationIntervals.clear();
  }
}