# Rate Limiting Implementation - Desktop App

## Overview
Simplified rate limiting focused on protecting vault PIN and sync operations in the desktop environment.

## Features

### 1. Vault PIN Rate Limiting (CRITICAL)
- **Max Attempts**: 5 failed attempts
- **Time Window**: 5 minutes
- **Block Duration**: 10 minutes after exceeding limit
- **User Feedback**: Shows remaining attempts when 3 or fewer remain
- **Reset**: Automatically resets on successful unlock
- **Persistence**: Stored in localStorage (survives app restarts)

### 2. Sync Operations Rate Limiting
- **Max Attempts**: 10 operations
- **Time Window**: 1 minute
- **Block Duration**: 5 minutes after exceeding limit
- **Applies To**: 
  - `pushSettings()` - Settings sync to GitHub
- **User Feedback**: Toast notification when rate limited
- **Purpose**: Protects GitHub API rate limits

## Implementation Details

### Rate Limiter Class (`src/core/rateLimiter.ts`)
- Singleton pattern for global rate limiting
- **Persistent storage** using localStorage (key difference from web app)
- Automatic cleanup of expired records every 5 minutes
- Desktop-optimized configurations

### Key Differences from Web App

1. **Persistent Storage**: 
   - Uses localStorage to persist rate limits across app restarts
   - Prevents bypassing by closing/reopening app

2. **Shorter Block Times**:
   - 10 minutes for PIN (vs 30 minutes in web)
   - User has physical access, so shorter blocks are acceptable

3. **Focused Scope**:
   - Only PIN and sync operations
   - No login or verification rate limiting (less relevant for desktop)

4. **Local-First**:
   - All rate limiting is client-side
   - No backend coordination needed

### Key Methods
- `isAllowed(operation, identifier)` - Check if operation is allowed
- `recordAttempt(operation, identifier)` - Record a failed attempt
- `reset(operation, identifier)` - Reset attempts (on success)
- `getRemainingAttempts(operation, identifier)` - Get remaining attempts
- `clearAll()` - Clear all rate limit records (admin/testing)

### Integration Points

1. **PIN Unlock** (`src/renderer/js/ui.ts` - `validateAndAutoUnlock`)
   - Checks rate limit before validating PIN
   - Records failed attempts
   - Resets on successful unlock
   - Shows remaining attempts in toast message
   - Blocks input when rate limited

2. **Sync Operations** (`src/renderer/js/ui.ts` - `pushSettings`)
   - Checks rate limit before sync
   - Records each sync attempt
   - Prevents sync spam
   - Shows toast when rate limited

## Security Benefits

1. **PIN Brute Force Protection**: 
   - Prevents automated PIN guessing
   - Limits manual brute force attempts
   - Persists across app restarts

2. **API Protection**: 
   - Prevents GitHub API rate limit exhaustion
   - Protects against accidental sync spam
   - Prevents sync conflicts from rapid changes

3. **Physical Access Mitigation**:
   - While physical access is a risk, rate limiting adds a layer of defense
   - Makes automated attacks impractical
   - Slows down manual brute force attempts

## User Experience

- Clear error messages with time remaining
- Attempt counter when approaching limit (≤3 attempts)
- Automatic reset after successful operations
- Persistent across app restarts (can't bypass by restarting)
- No impact on legitimate users

## Monitoring

The rate limiter provides statistics through `getStats()` method:
- Active rate limit records
- Blocked operations
- Attempt counts per operation

## Admin/Testing Features

- `clearAll()` method to reset all rate limits
- Useful for testing or emergency admin access
- Can be called from developer console

## Configuration

Current limits are optimized for desktop use:

```typescript
PIN Protection:
- 5 attempts per 5 minutes
- 10-minute block

Sync Protection:
- 10 operations per minute
- 5-minute block
```

## Future Enhancements

- Configurable limits in settings UI
- Export rate limit logs for security auditing
- Integration with system keychain for additional security
- Biometric unlock bypass (fingerprint/face ID)
- Progressive delays (exponential backoff)
