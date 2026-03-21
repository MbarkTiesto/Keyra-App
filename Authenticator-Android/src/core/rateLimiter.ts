/**
 * Persistent Rate Limiter
 * Survives app restarts via localStorage.
 * Covers: login, pin, verification, signup
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

type RateLimitResult =
    | { allowed: true; remainingAttempts: number }
    | { allowed: false; blockedUntil: Date; message: string; remainingMs: number };

const CONFIGS: Record<string, RateLimitConfig> = {
    login: {
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,       // 15 min window
        blockDurationMs: 30 * 60 * 1000  // 30 min block
    },
    pin: {
        maxAttempts: 5,
        windowMs: 10 * 60 * 1000,        // 10 min window
        blockDurationMs: 5 * 60 * 1000   // 5 min block (escalates)
    },
    verification: {
        maxAttempts: 3,
        windowMs: 10 * 60 * 1000,        // 10 min window
        blockDurationMs: 60 * 60 * 1000  // 1 hour block
    },
    signup: {
        maxAttempts: 5,
        windowMs: 60 * 60 * 1000,        // 1 hour window
        blockDurationMs: 60 * 60 * 1000  // 1 hour block
    }
};

const STORAGE_PREFIX = '__rl_';

class RateLimiter {
    private getKey(operation: string, identifier: string): string {
        return `${STORAGE_PREFIX}${operation}:${identifier}`;
    }

    private load(operation: string, identifier: string): AttemptRecord | null {
        try {
            const raw = localStorage.getItem(this.getKey(operation, identifier));
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    private save(operation: string, identifier: string, record: AttemptRecord): void {
        try {
            localStorage.setItem(this.getKey(operation, identifier), JSON.stringify(record));
        } catch {
            // localStorage full — fail open
        }
    }

    private remove(operation: string, identifier: string): void {
        localStorage.removeItem(this.getKey(operation, identifier));
    }

    // ─── Public API ────────────────────────────────────────────────────────────

    public isAllowed(operation: string, identifier: string): RateLimitResult {
        const config = CONFIGS[operation];
        if (!config) return { allowed: true, remainingAttempts: Infinity };

        const now = Date.now();
        const record = this.load(operation, identifier);

        // Currently blocked
        if (record?.blockedUntil && record.blockedUntil > now) {
            const remainingMs = record.blockedUntil - now;
            const minutes = Math.ceil(remainingMs / 60000);
            return {
                allowed: false,
                blockedUntil: new Date(record.blockedUntil),
                remainingMs,
                message: `Too many attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`
            };
        }

        // Window expired — clean slate
        if (record && (now - record.firstAttempt) > config.windowMs) {
            this.remove(operation, identifier);
            return { allowed: true, remainingAttempts: config.maxAttempts };
        }

        const used = record?.count ?? 0;
        const remaining = config.maxAttempts - used;
        return { allowed: true, remainingAttempts: Math.max(0, remaining) };
    }

    public recordAttempt(operation: string, identifier: string): RateLimitResult {
        const config = CONFIGS[operation];
        if (!config) return { allowed: true, remainingAttempts: Infinity };

        const now = Date.now();
        let record = this.load(operation, identifier);

        // Window expired — reset
        if (record && (now - record.firstAttempt) > config.windowMs) {
            record = null;
        }

        if (!record) {
            record = { count: 1, firstAttempt: now };
        } else {
            record.count++;
        }

        // Threshold reached — apply block with escalation for PIN
        if (record.count >= config.maxAttempts) {
            const escalation = operation === 'pin'
                ? Math.pow(2, Math.floor(record.count / config.maxAttempts) - 1)
                : 1;
            record.blockedUntil = now + config.blockDurationMs * escalation;
            this.save(operation, identifier, record);

            const remainingMs = record.blockedUntil - now;
            const minutes = Math.ceil(remainingMs / 60000);
            return {
                allowed: false,
                blockedUntil: new Date(record.blockedUntil),
                remainingMs,
                message: `Too many attempts. Locked for ${minutes} minute${minutes !== 1 ? 's' : ''}.`
            };
        }

        this.save(operation, identifier, record);
        const remaining = config.maxAttempts - record.count;
        return { allowed: true, remainingAttempts: remaining };
    }

    public reset(operation: string, identifier: string): void {
        this.remove(operation, identifier);
    }

    public getRemainingAttempts(operation: string, identifier: string): number {
        const config = CONFIGS[operation];
        if (!config) return Infinity;
        const record = this.load(operation, identifier);
        if (!record) return config.maxAttempts;
        const now = Date.now();
        if ((now - record.firstAttempt) > config.windowMs) return config.maxAttempts;
        return Math.max(0, config.maxAttempts - record.count);
    }

    public getBlockedUntil(operation: string, identifier: string): Date | null {
        const record = this.load(operation, identifier);
        if (!record?.blockedUntil) return null;
        if (record.blockedUntil <= Date.now()) return null;
        return new Date(record.blockedUntil);
    }

    /** Purge all expired rate limit records from localStorage */
    public cleanup(): void {
        const now = Date.now();
        const toDelete: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(STORAGE_PREFIX)) continue;
            try {
                const record: AttemptRecord = JSON.parse(localStorage.getItem(key)!);
                const opName = key.replace(STORAGE_PREFIX, '').split(':')[0];
                const config = CONFIGS[opName];
                if (!config) { toDelete.push(key); continue; }
                const expired = (now - record.firstAttempt) > config.windowMs;
                const unblocked = !record.blockedUntil || record.blockedUntil < now;
                if (expired && unblocked) toDelete.push(key);
            } catch {
                toDelete.push(key);
            }
        }

        toDelete.forEach(k => localStorage.removeItem(k));
    }
}

export const rateLimiter = new RateLimiter();

// Cleanup stale records on load and every 10 minutes
rateLimiter.cleanup();
setInterval(() => rateLimiter.cleanup(), 10 * 60 * 1000);
