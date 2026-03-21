import { safeStorage } from 'electron';
import * as crypto from 'crypto';

export interface AuthenticatorAccount {
    id: string;      // Unique identifier
    issuer: string;  // e.g. "GitHub"
    account: string; // e.g. "user@example.com"
    secret: string;  // Plaintext before saving, Encypted in storage
    isFavorite?: boolean;
    category?: string;
}

export interface EncryptedAccount extends Omit<AuthenticatorAccount, 'secret'> {
    encryptedSecret: string; // Base64 encoded encrypted buffer
}

/**
 * Encrypt a plain secret string using Electron safeStorage.
 * safeStorage uses OS-level encryption (Keychain on macOS, Credential Manager on Windows)
 */
export function encryptSecret(plainSecret: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
        // Fallback if OS encryption is somehow broken or unavailable
        // In a production app you might implement a custom AES fallback with a master password,
        // but for this scope, returning the string is better than failing, or we could throw.
        console.warn("safeStorage is unavailable, saving secret unencrypted. THIS IS A SECURITY RISK.");
        return Buffer.from(plainSecret, 'utf-8').toString('base64');
    }

    const encryptedBuffer = safeStorage.encryptString(plainSecret);
    return encryptedBuffer.toString('base64');
}

/**
 * Decrypt an encrypted secret back to plaintext
 */
export function decryptSecret(encryptedSecretBase64: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
        // Fallback decryption
        return Buffer.from(encryptedSecretBase64, 'base64').toString('utf-8');
    }

    try {
        const encryptedBuffer = Buffer.from(encryptedSecretBase64, 'base64');
        return safeStorage.decryptString(encryptedBuffer);
    } catch (err) {
        console.error("Failed to decrypt secret", err);
        throw new Error("Unable to decrypt account secret.");
    }
}

// ─── Multi-User Symmetric Encryption (AES-256-GCM) ─────────────────────────

const ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits
const DIGEST = 'sha256';

export function hashPassword(password: string): { hash: string, salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
    const attemptedHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    return hash === attemptedHash;
}

export function deriveKey(password: string, salt: string): Buffer {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

/**
 * Encrypts arbitrary string data (like a serialized JSON vault) using AES-256-GCM
 */
export function encryptVault(plainData: string, key: Buffer): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plainData, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted payload
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted string data
 */
export function decryptVault(encryptedData: string, key: Buffer): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) throw new Error("Invalid encrypted vault format");

    const [ivStr, authTagStr, encryptedPayload] = parts;
    const iv = Buffer.from(ivStr, 'base64');
    const authTag = Buffer.from(authTagStr, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedPayload, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
