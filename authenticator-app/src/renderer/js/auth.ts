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

                // Simulation Toast
                if (result.code) showSimulationToast(result.code);

                // Start Resend Timer
                startResendTimer();

                // Focus first box
                (document.querySelector('.verify-digit') as HTMLElement)?.focus();

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

    // 6-Digit Verification UI Logic
    const digitInputs = document.querySelectorAll('.verify-digit') as NodeListOf<HTMLInputElement>;
    digitInputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            const val = input.value;
            if (val && digitInputs[idx + 1]) {
                digitInputs[idx + 1].focus();
            }
            checkAutoSubmit();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !input.value && digitInputs[idx - 1]) {
                digitInputs[idx - 1].focus();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const data = e.clipboardData?.getData('text').slice(0, 6);
            if (data) {
                data.split('').forEach((char, i) => {
                    if (digitInputs[i]) digitInputs[i].value = char;
                });
                checkAutoSubmit();
            }
        });
    });

    async function checkAutoSubmit() {
        const code = Array.from(digitInputs).map(i => i.value).join('');
        if (code.length === 6) {
            await handleVerification(code);
        }
    }

    document.getElementById('form-verify')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = Array.from(digitInputs).map(i => i.value).join('');
        if (code.length < 6) {
            const err = document.getElementById('verify-error')!;
            err.textContent = "Please enter all 6 digits.";
            err.style.opacity = '1';
            return;
        }
        await handleVerification(code);
    });

    async function handleVerification(code: string) {
        const email = (document.getElementById('verify-email-field') as HTMLInputElement).value;
        const err = document.getElementById('verify-error')!;
        err.style.opacity = '0';

        try {
            const result = await window.api.verifyEmail(email, code);
            if (result.success) {
                // Success animation on boxes
                digitInputs.forEach(i => i.classList.add('valid'));

                setTimeout(() => {
                    boxVerify.classList.add('hidden');
                    boxLogin.classList.remove('hidden');
                    digitInputs.forEach(i => {
                        i.value = '';
                        i.classList.remove('valid');
                    });
                }, 800);
            } else {
                digitInputs.forEach(i => {
                    i.classList.add('invalid');
                    setTimeout(() => i.classList.remove('invalid'), 500);
                });
                err.textContent = result.message;
                err.style.opacity = '1';
            }
        } catch (error: any) {
            err.textContent = "Network sync error.";
            err.style.opacity = '1';
            console.error(error);
        }
    }

    // Resend Logic
    const btnResend = document.getElementById('btn-resend-code') as HTMLButtonElement;
    const resendTimerLabel = document.getElementById('resend-timer')!;
    let resendInterval: any;

    function startResendTimer() {
        let timeLeft = 60;
        btnResend.disabled = true;
        resendTimerLabel.style.display = 'inline';

        if (resendInterval) clearInterval(resendInterval);

        resendInterval = setInterval(() => {
            timeLeft--;
            resendTimerLabel.textContent = `(${timeLeft}s)`;
            if (timeLeft <= 0) {
                clearInterval(resendInterval);
                btnResend.disabled = false;
                resendTimerLabel.style.display = 'none';
            }
        }, 1000);
    }

    btnResend?.addEventListener('click', async () => {
        const email = (document.getElementById('verify-email-field') as HTMLInputElement).value;
        const result = await window.api.resendCode(email);
        if (result.success) {
            if (result.code) showSimulationToast(result.code);
            startResendTimer();
        }
    });

    // Simulation Toast
    function showSimulationToast(code: string) {
        const toast = document.getElementById('simulation-toast')!;
        const codeLabel = document.getElementById('sim-code')!;
        codeLabel.textContent = code;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 8000);
    }

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
