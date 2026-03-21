/**
 * Rate Limiter for Desktop App Security
 * Focuses on PIN protection and sync operation limits
 */

interface RateLimitConfig {
    maxAttempts: number;
    windowMs: number;
    blockDurationMs: number;
}

interface AttemptRecord {
    count: number;
    firstAttempt: number;
    blockedUntil?: number;
}

class RateLimiter {
    private storageKey = 'rate_limiter_records';
    private configs: Map<string, RateLimitConfig> = new Map();

    constructor() {
        // Desktop-specific configurations
        this.configs.set('pin', {
            maxAttempts: 5,
            windowMs: 5 * 60 * 1000, // 5 minutes
            blockDurationMs: 10 * 60 * 1000 // 10 minutes block
        });

        this.configs.set('sync', {
            maxAttempts: 10,
            windowMs: 60 * 1000, // 1 minute
            blockDurationMs: 5 * 60 * 1000 // 5 minutes block
        });

        // Clean up old records every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Load attempts from localStorage
     */
    private loadAttempts(): Map<string, AttemptRecord> {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                return new Map(Object.entries(data));
            }
        } catch (e) {
            console.error('Failed to load rate limit records:', e);
        }
        return new Map();
    }

    /**
     * Save attempts to localStorage
     */
    private saveAttempts(attempts: Map<string, AttemptRecord>): void {
        try {
            const data = Object.fromEntries(attempts);
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save rate limit records:', e);
        }
    }

    /**
     * Check if an operation is allowed
     */
    public isAllowed(operation: string, identifier: string): { 
        allowed: boolean; 
        remainingAttempts?: number; 
        blockedUntil?: Date; 
        message?: string;
        blockMinutes?: number;
    } {
        const key = `${operation}:${identifier}`;
        const config = this.configs.get(operation);

        if (!config) {
            console.warn(`No rate limit config for operation: ${operation}`);
            return { allowed: true };
        }

        const now = Date.now();
        const attempts = this.loadAttempts();
        const record = attempts.get(key);

        // Check if currently blocked
        if (record?.blockedUntil && record.blockedUntil > now) {
            const blockedUntilDate = new Date(record.blockedUntil);
            const minutesRemaining = Math.ceil((record.blockedUntil - now) / 60000);
            return {
                allowed: false,
                blockedUntil: blockedUntilDate,
                blockMinutes: minutesRemaining,
                message: `Too many attempts. Blocked for ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`
            };
        }

        // Check if window has expired
        if (record && (now - record.firstAttempt) > config.windowMs) {
            // Reset the record
            attempts.delete(key);
            this.saveAttempts(attempts);
            return { allowed: true, remainingAttempts: config.maxAttempts };
        }

        // Check attempt count
        if (record && record.count >= config.maxAttempts) {
            // Block the user
            record.blockedUntil = now + config.blockDurationMs;
            attempts.set(key, record);
            this.saveAttempts(attempts);
            
            const blockedUntilDate = new Date(record.blockedUntil);
            const minutesRemaining = Math.ceil(config.blockDurationMs / 60000);
            return {
                allowed: false,
                blockedUntil: blockedUntilDate,
                blockMinutes: minutesRemaining,
                message: `Too many attempts. Blocked for ${minutesRemaining} minutes.`
            };
        }

        const remainingAttempts = config.maxAttempts - (record?.count || 0);
        return { allowed: true, remainingAttempts };
    }

    /**
     * Record an attempt
     */
    public recordAttempt(operation: string, identifier: string): void {
        const key = `${operation}:${identifier}`;
        const now = Date.now();
        const attempts = this.loadAttempts();
        const record = attempts.get(key);

        if (!record) {
            attempts.set(key, {
                count: 1,
                firstAttempt: now
            });
        } else {
            record.count++;
            attempts.set(key, record);
        }

        this.saveAttempts(attempts);
    }

    /**
     * Reset attempts for a specific identifier (e.g., after successful unlock)
     */
    public reset(operation: string, identifier: string): void {
        const key = `${operation}:${identifier}`;
        const attempts = this.loadAttempts();
        attempts.delete(key);
        this.saveAttempts(attempts);
    }

    /**
     * Get remaining attempts
     */
    public getRemainingAttempts(operation: string, identifier: string): number {
        const key = `${operation}:${identifier}`;
        const config = this.configs.get(operation);
        const attempts = this.loadAttempts();
        const record = attempts.get(key);

        if (!config) return Infinity;
        if (!record) return config.maxAttempts;

        return Math.max(0, config.maxAttempts - record.count);
    }

    /**
     * Clean up expired records
     */
    private cleanup(): void {
        const now = Date.now();
        const attempts = this.loadAttempts();
        const keysToDelete: string[] = [];

        attempts.forEach((record, key) => {
            const operation = key.split(':')[0];
            const config = this.configs.get(operation);

            if (!config) {
                keysToDelete.push(key);
                return;
            }

            // Remove if window expired and not blocked
            if ((now - record.firstAttempt) > config.windowMs && (!record.blockedUntil || record.blockedUntil < now)) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => attempts.delete(key));
        if (keysToDelete.length > 0) {
            this.saveAttempts(attempts);
        }
    }

    /**
     * Get statistics for monitoring
     */
    public getStats(): { operation: string; identifier: string; attempts: number; blocked: boolean }[] {
        const now = Date.now();
        const attempts = this.loadAttempts();
        const stats: { operation: string; identifier: string; attempts: number; blocked: boolean }[] = [];

        attempts.forEach((record, key) => {
            const [operation, identifier] = key.split(':');
            stats.push({
                operation,
                identifier,
                attempts: record.count,
                blocked: !!(record.blockedUntil && record.blockedUntil > now)
            });
        });

        return stats;
    }

    /**
     * Clear all rate limit records (for testing or admin reset)
     */
    public clearAll(): void {
        localStorage.removeItem(this.storageKey);
    }
}

// Singleton instance
export const rateLimiter = new RateLimiter();
