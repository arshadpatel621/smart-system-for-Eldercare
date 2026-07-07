/**
 * camera.crypto.ts
 * AES-256-CBC encryption/decryption utilities for secure credential storage.
 * Passwords are NEVER stored in plaintext or logged anywhere.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 128-bit IV for AES-CBC

/**
 * Derives a 32-byte key from the environment variable.
 * Falls back to a deterministic hash of a default string for development.
 * WARNING: In production, always set ENCRYPTION_KEY to a unique 32+ char secret.
 */
function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY || 'eldercare-camera-default-dev-key!';
  // Hash to exactly 32 bytes regardless of input length
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Returns a Base64 string in the format: iv:encryptedData
 *
 * @param plaintext - The value to encrypt (e.g., camera password)
 * @returns Encrypted string (iv + ciphertext, Base64-encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  // Format: base64(iv):base64(encrypted)
  return `${iv.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts an AES-256-CBC encrypted string.
 * Input must be in format: base64(iv):base64(ciphertext)
 *
 * @param encrypted - The encrypted value from the database
 * @returns Decrypted plaintext string
 */
export function decrypt(encrypted: string): string {
  if (!encrypted) return '';
  const [ivBase64, encryptedBase64] = encrypted.split(':');
  if (!ivBase64 || !encryptedBase64) {
    throw new Error('Invalid encrypted value format — expected iv:ciphertext');
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, 'base64');
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Checks whether a string looks like it has already been encrypted
 * (prevents double-encrypting on update operations).
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  if (parts.length !== 2) return false;
  // Both parts should be valid Base64
  const b64Regex = /^[A-Za-z0-9+/]+=*$/;
  return b64Regex.test(parts[0]) && b64Regex.test(parts[1]);
}
