import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// Derive key from password using PBKDF2
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

// Encrypt data at rest
export function encryptData(data: string | Buffer, password: string): string {
  // Convert string data to buffer
  const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive key from password
  const key = deriveKey(password, salt);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Encrypt data
  const encrypted = Buffer.concat([
    cipher.update(dataBuffer),
    cipher.final()
  ]);
  
  // Get auth tag
  const tag = cipher.getAuthTag();
  
  // Combine salt, iv, tag, and encrypted data
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  
  // Return base64 encoded string
  return combined.toString('base64');
}

// Decrypt data at rest
export function decryptData(encryptedData: string, password: string): string {
  // Decode from base64
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract components
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  // Derive key from password
  const key = deriveKey(password, salt);
  
  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  // Decrypt data
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
}

// Encrypt file for storage
export async function encryptFile(
  fileBuffer: Buffer,
  encryptionKey: string
): Promise<{
  encryptedData: Buffer;
  encryptionMetadata: {
    algorithm: string;
    keyDerivation: string;
    encrypted: boolean;
  };
}> {
  const encryptedString = encryptData(fileBuffer, encryptionKey);
  const encryptedData = Buffer.from(encryptedString, 'base64');
  
  return {
    encryptedData,
    encryptionMetadata: {
      algorithm: ALGORITHM,
      keyDerivation: 'pbkdf2-sha256',
      encrypted: true,
    },
  };
}

// Decrypt file from storage
export async function decryptFile(
  encryptedBuffer: Buffer,
  encryptionKey: string
): Promise<Buffer> {
  const encryptedString = encryptedBuffer.toString('base64');
  const decryptedString = decryptData(encryptedString, encryptionKey);
  return Buffer.from(decryptedString, 'base64');
}

// Generate encryption key for user data
export function generateUserEncryptionKey(userId: string, secret: string): string {
  // Create a deterministic key for the user
  const hash = crypto.createHash('sha256');
  hash.update(`${userId}:${secret}`);
  return hash.digest('base64');
}

// Encrypt sensitive user data
export function encryptSensitiveData(
  data: Record<string, any>,
  encryptionKey: string
): Record<string, any> {
  const sensitiveFields = ['email', 'phone', 'address', 'ssn', 'creditCard'];
  const encryptedData = { ...data };
  
  for (const field of sensitiveFields) {
    if (field in encryptedData && encryptedData[field]) {
      encryptedData[field] = encryptData(
        JSON.stringify(encryptedData[field]),
        encryptionKey
      );
      encryptedData[`${field}_encrypted`] = true;
    }
  }
  
  return encryptedData;
}

// Decrypt sensitive user data
export function decryptSensitiveData(
  encryptedData: Record<string, any>,
  encryptionKey: string
): Record<string, any> {
  const decryptedData = { ...encryptedData };
  
  for (const field in decryptedData) {
    if (field.endsWith('_encrypted') && decryptedData[field] === true) {
      const actualField = field.replace('_encrypted', '');
      if (actualField in decryptedData) {
        try {
          decryptedData[actualField] = JSON.parse(
            decryptData(decryptedData[actualField], encryptionKey)
          );
          delete decryptedData[field];
        } catch (error) {
          console.error(`Failed to decrypt field ${actualField}:`, error);
        }
      }
    }
  }
  
  return decryptedData;
}

// Hash sensitive data for indexing (one-way)
export function hashSensitiveData(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256');
  hash.update(`${actualSalt}:${data}`);
  return `${actualSalt}:${hash.digest('hex')}`;
}

// Verify hashed data
export function verifyHashedData(data: string, hashedValue: string): boolean {
  const [salt] = hashedValue.split(':');
  return hashSensitiveData(data, salt) === hashedValue;
}