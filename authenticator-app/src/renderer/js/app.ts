import { syncVault } from './store.js';
import { setupUI, renderAccounts, lockVault } from './ui.js';
import { setupAuthUI, setAppInitCallback } from './auth.js';

let inactivityTimer: any = null;

function resetInactivityTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);

    const uid = (window as any).currentUserId || 'default';
    const timeoutMinutes = parseInt(localStorage.getItem(`${uid}_autolock`) || '0');
    if (timeoutMinutes > 0) {
        inactivityTimer = setTimeout(() => {
            lockVault();
        }, timeoutMinutes * 60 * 1000);
    }
}

// ─── Setup Listeners for Inactivity ─────────────────────────────
function initAutoLock() {
    ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, resetInactivityTimer, true);
    });
    resetInactivityTimer();
}

async function init() {
    setupAuthUI();

    setAppInitCallback(() => {
        // 0. Startup Security Check (Post-Auth)
        const uid = (window as any).currentUserId || 'default';
        const hasPin = !!localStorage.getItem(`${uid}_vault_pin`);
        if (hasPin) lockVault();

        // 2. Setup UI Components
        setupUI();

        // 5. Initialize Security Logic
        initAutoLock();
    });
}

document.addEventListener('DOMContentLoaded', init);
