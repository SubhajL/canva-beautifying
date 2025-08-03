import { uploadFile, downloadFile, deleteFile } from '@/lib/r2';
import { encryptFile, decryptFile, generateUserEncryptionKey } from '@/lib/utils/encryption';
import crypto from 'crypto';

// Get encryption key from environment
const getEncryptionSecret = () => {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_SECRET environment variable is not set');
  }
  return secret;
};

// Upload file with encryption
export async function uploadSecureFile(
  file: Buffer,
  key: string,
  contentType: string,
  userId: string,
  metadata?: Record<string, string>
): Promise<string> {
  try {
    // Generate user-specific encryption key
    const encryptionKey = generateUserEncryptionKey(userId, getEncryptionSecret());
    
    // Encrypt the file
    const { encryptedData, encryptionMetadata } = await encryptFile(
      file,
      encryptionKey
    );
    
    // Add encryption metadata
    const _secureMetadata = {
      ...metadata,
      ...encryptionMetadata,
      encryptedBy: userId,
      encryptedAt: new Date().toISOString(),
    };
    
    // Upload encrypted file
    return await uploadFile(
      encryptedData,
      key,
      contentType
    );
  } catch (error) {
    console.error('Secure upload failed:', error);
    throw new Error('Failed to securely upload file');
  }
}

// Download and decrypt file
export async function downloadSecureFile(
  key: string,
  userId: string
): Promise<Buffer> {
  try {
    // Download encrypted file
    const encryptedData = await downloadFile(key);
    
    if (!encryptedData) {
      throw new Error('File not found');
    }
    
    // Generate user-specific encryption key
    const encryptionKey = generateUserEncryptionKey(userId, getEncryptionSecret());
    
    // Decrypt the file
    return await decryptFile(encryptedData, encryptionKey);
  } catch (error) {
    console.error('Secure download failed:', error);
    throw new Error('Failed to securely download file');
  }
}

// Get secure file URL with temporary access
export async function getSecureFileUrl(
  key: string,
  userId: string,
  expiresIn = 3600 // 1 hour default
): Promise<string> {
  // For encrypted files, we need to provide a proxy URL that handles decryption
  // This would be implemented as an API endpoint that verifies user access
  // and decrypts the file on-the-fly
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const token = generateTemporaryAccessToken(key, userId, expiresIn);
  
  return `${baseUrl}/api/v1/secure-files/${encodeURIComponent(key)}?token=${token}`;
}

// Generate temporary access token for secure files
function generateTemporaryAccessToken(
  key: string,
  userId: string,
  expiresIn: number
): string {
  const expires = Date.now() + (expiresIn * 1000);
  
  const payload = JSON.stringify({ key, userId, expires });
  const secret = getEncryptionSecret();
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  
  // Create token with payload and signature
  const token = Buffer.from(JSON.stringify({
    payload,
    signature,
  })).toString('base64url');
  
  return token;
}

// Verify temporary access token
export function verifyTemporaryAccessToken(token: string): {
  valid: boolean;
  key?: string;
  userId?: string;
} {
  try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
    const { payload, signature } = decoded;
    
    // Verify signature
    const secret = getEncryptionSecret();
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    if (signature !== expectedSignature) {
      return { valid: false };
    }
    
    // Parse and verify payload
    const { key, userId, expires } = JSON.parse(payload);
    
    if (Date.now() > expires) {
      return { valid: false };
    }
    
    return { valid: true, key, userId };
  } catch (_error) {
    return { valid: false };
  }
}

// Delete secure file
export async function deleteSecureFile(
  key: string,
  _userId: string
): Promise<void> {
  // In a production system, you might want to:
  // 1. Verify the user has permission to delete this file
  // 2. Log the deletion for audit purposes
  // 3. Implement soft delete with retention period
  
  await deleteFile(key);
}

// Batch upload with encryption
export async function uploadSecureFiles(
  files: Array<{
    buffer: Buffer;
    key: string;
    contentType: string;
    metadata?: Record<string, string>;
  }>,
  userId: string
): Promise<string[]> {
  const uploadPromises = files.map(file => 
    uploadSecureFile(
      file.buffer,
      file.key,
      file.contentType,
      userId,
      file.metadata
    )
  );
  
  return Promise.all(uploadPromises);
}