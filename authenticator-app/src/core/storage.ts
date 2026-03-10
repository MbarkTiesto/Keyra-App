import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AuthenticatorAccount, encryptVault, decryptVault } from './crypto';

const STORE_PATH = path.join(app.getPath('userData'), 'users.json');

export interface UserRecord {
    id: string;
    username: string;
    email: string;
    hash: string;
    salt: string;
    isActivated: boolean;
    activationCode?: string; // Tmp code for simulated email validation
    encryptedVaultData: string; // The user's AES-256-GCM encrypted vault
}

export function getUsers(): UserRecord[] {
    try {
        if (!fs.existsSync(STORE_PATH)) return [];
        const data = fs.readFileSync(STORE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to read users.json', error);
        return [];
    }
}

export function saveUsers(users: UserRecord[]): void {
    try {
        fs.writeFileSync(STORE_PATH, JSON.stringify(users, null, 2), 'utf-8');
    } catch (error) {
        console.error('Failed to save users.json', error);
        throw error;
    }
}

/**
 * Utility to back up raw user data (Not recommended to expose directly to user without warnings)
 */
export function backupUsers(filePath: string, users: UserRecord[]): void {
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');
}
