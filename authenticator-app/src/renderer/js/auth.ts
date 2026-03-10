import { syncVault } from './store.js';
import { renderAccounts } from './ui.js';
import { runTimer } from './timer.js';
import { setupScanner } from './qr.js';

let appInitCallback: (() => void) | null = null;

export function setAppInitCallback(cb: () => void) {
    appInitCallback = cb;
}

export async function setupAuthUI() {
    const vessel = document.getElementById('auth-vessel');
    const boxLogin = document.getElementById('auth-login-box')!;
    const boxSignup = document.getElementById('auth-signup-box')!;
    const boxVerify = document.getElementById('auth-verify-box')!;

    // 0. Auto-Login Sequence
    try {
        const auto = await window.api.checkSession();
        if (auto.success) {
            // Unveil vault
            if (vessel) vessel.classList.remove('show');

            // Hydrate User Profile UI
            const currentUser = await window.api.getCurrentUser();
            if (currentUser) {
                const labelUser = document.getElementById('label-username');
                const dropUser = document.getElementById('drop-username');
                const dropEmail = document.getElementById('drop-email');
                if (labelUser) labelUser.textContent = currentUser.username;
                if (dropUser) dropUser.textContent = currentUser.username;
                if (dropEmail) dropEmail.textContent = currentUser.email;

                // Bind UserID for LocalStorage Scoping
                (window as any).currentUserId = currentUser.id;
            }

            if (appInitCallback) appInitCallback();

            // Fire off initial render
            await syncVault(() => renderAccounts());
            runTimer();
            setupScanner();
        }
    } catch (e) { console.error("Session resume failed"); }

    // Navigation Buttons
    document.getElementById('btn-show-signup')?.addEventListener('click', () => {
        boxLogin.classList.add('hidden');
        boxSignup.classList.remove('hidden');
    });

    document.getElementById('btn-show-login')?.addEventListener('click', () => {
        boxSignup.classList.add('hidden');
        boxLogin.classList.remove('hidden');
    });

    document.getElementById('btn-show-login-from-verify')?.addEventListener('click', () => {
        boxVerify.classList.add('hidden');
        boxLogin.classList.remove('hidden');
    });

    // Forms
    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = (document.getElementById('login-username') as HTMLInputElement).value;
        const pass = (document.getElementById('login-password') as HTMLInputElement).value;
        const err = document.getElementById('login-error')!;

        err.style.opacity = '0';
        try {
            const result = await window.api.login(user, pass);
            if (result.success) {
                if (vessel) vessel.classList.remove('show'); // Hide auth overlay via CSS transition

                // Hydrate User Profile UI
                const currentUser = await window.api.getCurrentUser();
                if (currentUser) {
                    const labelUser = document.getElementById('label-username');
                    const dropUser = document.getElementById('drop-username');
                    const dropEmail = document.getElementById('drop-email');
                    if (labelUser) labelUser.textContent = currentUser.username;
                    if (dropUser) dropUser.textContent = currentUser.username;
                    if (dropEmail) dropEmail.textContent = currentUser.email;

                    // Bind UserID for LocalStorage Scoping
                    (window as any).currentUserId = currentUser.id;
                }

                if (appInitCallback) appInitCallback();    // Bootstrap main app

                // Fire off initial render
                await syncVault(() => renderAccounts());
                runTimer();
                setupScanner();
            } else {
                err.textContent = result.message;
                err.style.opacity = '1';
            }
        } catch (error: any) {
            err.textContent = "Error communicating with vault core.";
            err.style.opacity = '1';
            console.error(error);
        }
    });

    document.getElementById('form-signup')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = (document.getElementById('signup-username') as HTMLInputElement).value;
        const email = (document.getElementById('signup-email') as HTMLInputElement).value;
        const pass = (document.getElementById('signup-password') as HTMLInputElement).value;
        const err = document.getElementById('signup-error')!;

        err.style.opacity = '0';
        try {
            const result = await window.api.signup(user, email, pass);
            if (result.success) {
                // Move to verify view
                boxSignup.classList.add('hidden');
                boxVerify.classList.remove('hidden');
                (document.getElementById('verify-email-field') as HTMLInputElement).value = email;

                // Reset inputs
                (document.getElementById('signup-username') as HTMLInputElement).value = '';
                (document.getElementById('signup-password') as HTMLInputElement).value = '';
            } else {
                err.textContent = result.message;
                err.style.opacity = '1';
            }
        } catch (error: any) {
            err.textContent = "Error computing crypto registry.";
            err.style.opacity = '1';
            console.error(error);
        }
    });

    document.getElementById('form-verify')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = (document.getElementById('verify-email-field') as HTMLInputElement).value;
        const code = (document.getElementById('verify-code') as HTMLInputElement).value;
        const err = document.getElementById('verify-error')!;

        err.style.opacity = '0';
        try {
            const result = await window.api.verifyEmail(email, code);
            if (result.success) {
                boxVerify.classList.add('hidden');
                boxLogin.classList.remove('hidden');
                (document.getElementById('verify-code') as HTMLInputElement).value = '';
                // The newly registered user can now just log in properly.
            } else {
                err.textContent = result.message;
                err.style.opacity = '1';
            }
        } catch (error: any) {
            err.textContent = "Network sync error.";
            err.style.opacity = '1';
            console.error(error);
        }
    });

    // Profile Dropdown Logic
    const btnProfile = document.getElementById('btn-user-profile');
    const profileDropdown = document.getElementById('profile-dropdown');
    const btnLogout = document.getElementById('btn-logout');

    btnProfile?.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown?.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        if (profileDropdown && !profileDropdown.classList.contains('hidden')) {
            profileDropdown.classList.add('hidden');
        }
    });

    profileDropdown?.addEventListener('click', (e) => e.stopPropagation());

    btnLogout?.addEventListener('click', () => {
        profileDropdown?.classList.add('hidden');
        document.getElementById('modal-logout')?.classList.remove('hidden');
        document.getElementById('modal-logout')?.classList.add('show');
    });

    document.getElementById('btn-cancel-logout')?.addEventListener('click', () => {
        const m = document.getElementById('modal-logout');
        if (m) {
            m.classList.remove('show');
            m.classList.add('hidden');
        }
    });

    document.getElementById('btn-confirm-logout')?.addEventListener('click', async () => {
        // Hide Modal
        const m = document.getElementById('modal-logout');
        if (m) {
            m.classList.remove('show');
            m.classList.add('hidden');
        }

        await window.api.logout();

        // Reset App State visually
        document.getElementById('accounts-list')!.innerHTML = '';

        // Show Auth Vessel again
        if (vessel) {
            vessel.classList.add('show');
            boxLogin.classList.remove('hidden');
            boxSignup.classList.add('hidden');
            boxVerify.classList.add('hidden');
            (document.getElementById('login-password') as HTMLInputElement).value = '';
            document.getElementById('login-password')?.focus();
        }
    });
}
