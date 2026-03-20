/**
 * Generates a Keyra .keyra backup file with 30 test accounts.
 * Master password: 11111111
 * Run: node scripts/gen-backup.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';
const PASSWORD = '11111111';

function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

function encryptVault(plainData, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainData, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

function generateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

// 30 realistic test accounts
const accounts = [
    { issuer: 'Google',       account: 'user@gmail.com' },
    { issuer: 'GitHub',       account: 'devuser' },
    { issuer: 'Microsoft',    account: 'user@outlook.com' },
    { issuer: 'Apple',        account: 'user@icloud.com' },
    { issuer: 'Discord',      account: 'user#1234' },
    { issuer: 'Twitter',      account: '@testuser' },
    { issuer: 'Facebook',     account: 'user@facebook.com' },
    { issuer: 'Instagram',    account: '@testuser' },
    { issuer: 'LinkedIn',     account: 'user@linkedin.com' },
    { issuer: 'Dropbox',      account: 'user@dropbox.com' },
    { issuer: 'Stripe',       account: 'user@stripe.com' },
    { issuer: 'PayPal',       account: 'user@paypal.com' },
    { issuer: 'Binance',      account: 'user@binance.com' },
    { issuer: 'Coinbase',     account: 'user@coinbase.com' },
    { issuer: 'Slack',        account: 'user@workspace.slack.com' },
    { issuer: 'Twitch',       account: 'twitchuser' },
    { issuer: 'Spotify',      account: 'user@spotify.com' },
    { issuer: 'Steam',        account: 'steamuser' },
    { issuer: 'Figma',        account: 'user@figma.com' },
    { issuer: 'Adobe',        account: 'user@adobe.com' },
    { issuer: 'Shopify',      account: 'user@shop.com' },
    { issuer: 'Reddit',       account: 'u/testuser' },
    { issuer: 'GitLab',       account: 'user@gitlab.com' },
    { issuer: 'Netlify',      account: 'user@netlify.com' },
    { issuer: 'Vercel',       account: 'user@vercel.com' },
    { issuer: 'Cloudflare',   account: 'user@cloudflare.com' },
    { issuer: 'Bitwarden',    account: 'user@bitwarden.com' },
    { issuer: '1Password',    account: 'user@1password.com' },
    { issuer: 'Notion',       account: 'user@notion.so' },
    { issuer: 'Zoom',         account: 'user@zoom.us' },
].map((a, i) => ({
    id: `test-account-${i + 1}`,
    issuer: a.issuer,
    account: a.account,
    // Valid base32 TOTP secrets (16 chars each)
    secret: 'JBSWY3DPEHPK3PXP',
    isFavorite: false,
    category: ''
}));

const salt = crypto.randomBytes(16).toString('hex');
const key = deriveKey(PASSWORD, salt);

const encryptedVaultData = encryptVault(JSON.stringify(accounts), key);

const settings = {
    autolock: { enabled: false, timeout: 5 },
    "Desktop Settings": {},
    "Web Settings": {}
};
const encryptedSettings = encryptVault(JSON.stringify(settings), key);

const checksumData = salt + encryptedVaultData + encryptedSettings;
const checksum = generateChecksum(checksumData);

const backup = {
    version: "1.2.0",
    timestamp: Date.now(),
    accountCount: accounts.length,
    salt,
    encryptedVaultData,
    encryptedSettings,
    checksum
};

const outPath = path.join(__dirname, '..', 'test-30-accounts.keyra');
fs.writeFileSync(outPath, JSON.stringify(backup));
console.log(`✓ Backup written to: ${outPath}`);
console.log(`  Accounts: ${accounts.length}`);
console.log(`  Password: ${PASSWORD}`);
