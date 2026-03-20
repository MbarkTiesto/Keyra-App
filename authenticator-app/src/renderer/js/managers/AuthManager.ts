export interface AuthCallbacks {
    getUserId: () => string;
    getStorageKey: (key: string) => string;
    showToast: (msg: string, type: 'info' | 'success' | 'error') => void;
    setLoading: (show: boolean, title?: string, subtitle?: string) => void;
    showModal: (content: string) => void;
    hideModal: () => void;
    showStaticModal: (id: string) => void;
    pushSettings: () => Promise<any>;
    updateSyncIndicator: (state: string) => void;
    setSyncVisible: (visible: boolean) => void;
    formatSyncTime: (date: Date) => string;
}

export class AuthManager {
    private emailResendTimer: number = 0;
    private emailResendInterval: any = null;
    private waListenerCleanups: Array<() => void> = [];

    constructor(private cb: AuthCallbacks) {}

    async initFromCloud() {
        const user = await (window as any).api.getCurrentUser();
        if (user) {
            const desktopSettings = user["Desktop Settings"] || user.settings || {};
            return desktopSettings;
        }
        return null;
    }

    updateLastActivity(action: string) {
        const now = new Date().toISOString();
        localStorage.setItem(this.cb.getStorageKey('last_activity'), now);
        localStorage.setItem(this.cb.getStorageKey('last_action'), action);
        this.updateLastActivityDisplay();
    }

    updateLastActivityDisplay() {
        const lastActivityElement = document.getElementById('last-activity-display');
        const lastActionElement = document.getElementById('last-action-display');
        const lastActivity = localStorage.getItem(this.cb.getStorageKey('last_activity'));
        const lastAction = localStorage.getItem(this.cb.getStorageKey('last_action')) || 'No activity';

        if (lastActivity && lastActivityElement) {
            const date = new Date(lastActivity);
            const diffMins = Math.floor((new Date().getTime() - date.getTime()) / 60000);
            let timeAgo = 'Just now';
            if (diffMins >= 1 && diffMins < 60) timeAgo = `${diffMins}m ago`;
            else if (diffMins >= 60 && diffMins < 1440) timeAgo = `${Math.floor(diffMins / 60)}h ago`;
            else if (diffMins >= 1440) timeAgo = `${Math.floor(diffMins / 1440)}d ago`;
            lastActivityElement.textContent = timeAgo;
        }
        if (lastActionElement) lastActionElement.textContent = lastAction;

        const aboutAction = document.getElementById('about-last-action');
        const aboutSync = document.getElementById('about-last-sync');
        if (aboutAction) aboutAction.textContent = lastAction;
        if (aboutSync) {
            const lastSync = localStorage.getItem(this.cb.getStorageKey('last_sync'));
            aboutSync.textContent = lastSync ? this.cb.formatSyncTime(new Date(lastSync)) : 'Never Secured';
        }
    }

    async loadAccountInfo() {
        const user = await (window as any).api.getCurrentUser();
        if (!user) return;

        const dispName = document.getElementById('acc-display-username');
        const dispEmail = document.getElementById('acc-primary-email');
        const initialsEl = document.getElementById('acc-initials');
        const avatarImgEl = document.getElementById('acc-avatar-img') as HTMLImageElement;

        if (dispName) dispName.textContent = user.username;
        if (dispEmail) dispEmail.textContent = user.isLocal ? "Local-Only Account" : user.email;

        this.handleLocalAccountUI(user);
        this.loadDevices();

        if (avatarImgEl && initialsEl) {
            if (user.profilePicture) {
                avatarImgEl.src = user.profilePicture;
                avatarImgEl.classList.remove('hidden');
                initialsEl.classList.add('hidden');
            } else {
                avatarImgEl.classList.add('hidden');
                initialsEl.classList.remove('hidden');
                const names = user.username.split(' ');
                initialsEl.textContent = names.length > 1
                    ? (names[0][0] + names[1][0]).toUpperCase()
                    : user.username.slice(0, 2).toUpperCase();
            }
        }

        const navbarAvatarImg = document.getElementById('navbar-avatar-img') as HTMLImageElement;
        const navbarAvatarInitials = document.getElementById('navbar-avatar-initials');
        if (navbarAvatarImg && navbarAvatarInitials) {
            if (user.profilePicture) {
                navbarAvatarImg.src = user.profilePicture;
                navbarAvatarImg.classList.remove('hidden');
                navbarAvatarInitials.classList.add('hidden');
            } else {
                navbarAvatarImg.classList.add('hidden');
                navbarAvatarInitials.classList.remove('hidden');
                navbarAvatarInitials.textContent = user.username.charAt(0).toUpperCase();
            }
        }

        const badge = document.getElementById('pending-email-badge');
        const actionBox = document.getElementById('pending-email-action-box');
        const pendingText = document.getElementById('pending-email-text');
        if (!user.isLocal && user.pendingEmail) {
            badge?.classList.remove('hidden');
            if (badge) {
                badge.textContent = 'NOT VERIFIED';
                badge.className = 'badge danger';
            }
            actionBox?.classList.remove('hidden');
            if (pendingText) pendingText.textContent = `Verify: ${user.pendingEmail}`;
        } else {
            badge?.classList.add('hidden');
            actionBox?.classList.add('hidden');
        }
    }

    handleLocalAccountUI(user: any) {
        const syncCard = document.getElementById('sync-settings-card');
        const syncOverlay = document.getElementById('sync-disabled-overlay');
        const syncTitle = document.getElementById('sync-settings-title');
        const syncSubtitle = document.getElementById('sync-settings-subtitle');
        const syncStatusDesc = document.getElementById('sync-status-desc');
        const syncToggle = document.getElementById('cloud-sync-toggle') as HTMLInputElement;

        if (user.isLocal) {
            document.body.classList.add('local-only');
            const hasPrivateSync = !!(user.privateSync && user.privateSync.pat);
            document.getElementById('connectivity-status')?.classList.toggle('pill-disabled', !hasPrivateSync);

            if (hasPrivateSync) {
                if (syncTitle) syncTitle.textContent = "Private Sync";
                if (syncSubtitle) syncSubtitle.textContent = "GITHUB REPOSITORY STORAGE";
                if (syncStatusDesc) syncStatusDesc.textContent = user.privateSync.enabled ? "Private GitHub Sync Active" : "Private Sync Paused";
                if (syncCard) syncCard.classList.remove('disabled-card');
                if (syncOverlay) { syncOverlay.classList.add('hidden'); (syncOverlay as HTMLElement).style.display = 'none'; }
                if (syncToggle) syncToggle.checked = !!user.privateSync.enabled;
            } else {
                const desc = document.getElementById('sync-status-desc');
                if (desc) desc.textContent = "Offline Mode Active";
                if (syncCard) syncCard.classList.add('disabled-card');
                if (syncOverlay) { syncOverlay.classList.remove('hidden'); (syncOverlay as HTMLElement).style.display = 'flex'; }
            }
            this.cb.setSyncVisible(!!(user.privateSync && user.privateSync.enabled));
            this.cb.updateSyncIndicator('synced');
        } else {
            document.body.classList.remove('local-only');
            document.getElementById('connectivity-status')?.classList.remove('pill-disabled');
            if (syncTitle) syncTitle.textContent = "Cloud Sync";
            if (syncSubtitle) syncSubtitle.textContent = "Keep your Vault safe";
            const autosyncDesc = document.getElementById('autosync-desc');
            if (autosyncDesc) autosyncDesc.textContent = "Save changes instantly";
            if (syncCard) syncCard.classList.remove('disabled-card');
            if (syncOverlay) syncOverlay.classList.add('hidden');
            this.cb.setSyncVisible(true);
            this.cb.updateSyncIndicator('synced');
        }

        const privateSyncBtn = document.getElementById('btn-open-private-sync');
        if (privateSyncBtn && user.isLocal) {
            privateSyncBtn.innerHTML = user.privateSync?.enabled
                ? '<i class="fa-solid fa-gear"></i><span>Configure Private Sync</span>'
                : '<i class="fa-solid fa-shield-halved"></i><span>Enable Private Sync</span>';
        }
    }

    async updateAccountView() {
        const user = await (window as any).api.getCurrentUser();
        if (!user) return;

        const nameDisplay = document.getElementById('acc-display-username');
        const emailDisplay = document.getElementById('acc-primary-email');
        const initials = document.getElementById('acc-initials');
        if (nameDisplay) nameDisplay.textContent = user.username;
        if (emailDisplay) emailDisplay.textContent = user.isLocal ? "Local-Only Account" : user.email;
        if (initials) initials.textContent = user.username.charAt(0).toUpperCase();

        // Local users have no cloud email/phone features
        if (user.isLocal) {
            document.getElementById('pending-email-badge')?.classList.add('hidden');
            document.getElementById('pending-email-action-box')?.classList.add('hidden');
            return;
        }

        const pendingBadge = document.getElementById('pending-email-badge');
        const pendingAction = document.getElementById('pending-email-action-box');
        const pendingText = document.getElementById('pending-email-text');
        if (user.pendingEmail) {
            pendingBadge?.classList.remove('hidden');
            pendingAction?.classList.remove('hidden');
            if (pendingText) pendingText.textContent = `Confirming your new email: ${user.pendingEmail}`;
        } else {
            pendingBadge?.classList.add('hidden');
            pendingAction?.classList.add('hidden');
        }

        const phoneDisplay = document.getElementById('current-phone-display');
        const phoneStatusText = document.getElementById('phone-status-text');
        const phoneBadge = document.getElementById('phone-status-badge');
        const phoneActionBox = document.getElementById('phone-verify-action-box');
        const requestForm = document.getElementById('form-request-phone-verification');
        const removeBtn = document.getElementById('btn-remove-phone');

        if (user.phone && user.isPhoneVerified) {
            if (phoneDisplay) phoneDisplay.textContent = user.phone;
            if (phoneStatusText) phoneStatusText.textContent = "VERIFIED NUMBER";
            if (phoneBadge) { phoneBadge.textContent = "SECURE"; phoneBadge.className = "badge success"; }
            phoneActionBox?.classList.add('hidden');
            requestForm?.classList.add('hidden');
            removeBtn?.classList.remove('hidden');
        } else if (user.pendingPhone) {
            if (phoneDisplay) phoneDisplay.textContent = user.pendingPhone;
            if (phoneStatusText) phoneStatusText.textContent = "AWAITING VERIFICATION";
            if (phoneBadge) { phoneBadge.textContent = "PENDING"; phoneBadge.className = "badge info"; }
            phoneActionBox?.classList.remove('hidden');
            const verifyNowBtn = document.getElementById('btn-verify-now');
            if (verifyNowBtn) verifyNowBtn.onclick = () => this.showPhoneQrModal();
            requestForm?.classList.add('hidden');
            removeBtn?.classList.remove('hidden');
        } else {
            if (phoneDisplay) phoneDisplay.textContent = "No Phone Set";
            if (phoneStatusText) phoneStatusText.textContent = "NOT VERIFIED";
            if (phoneBadge) { phoneBadge.textContent = "UNPROTECTED"; phoneBadge.className = "badge danger"; }
            phoneActionBox?.classList.add('hidden');
            requestForm?.classList.remove('hidden');
            removeBtn?.classList.add('hidden');
        }

        if (removeBtn) {
            removeBtn.onclick = async () => {
                const user = await (window as any).api.getCurrentUser();
                if (user?.isLocal) { this.cb.showToast("Phone removal is not available for local accounts", "info"); return; }
                this.cb.showModal(`
                    <div class="modal-content">
                        <div class="nm-modal-header">
                            <div class="nm-modal-icon danger"><i class="fa-solid fa-phone-slash"></i></div>
                            <div class="nm-modal-titles"><h2 class="nm-modal-title danger">Remove Phone?</h2><p class="nm-modal-subtitle">DUAL-CHANNEL PROTECTION WILL BE DISABLED</p></div>
                        </div>
                        <div class="nm-modal-divider"></div>
                        <div class="modal-body">
                            <p class="nm-modal-help">Removing your phone number disables WhatsApp-based PIN recovery and dual-channel protection. This action is immediate.</p>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-danger" id="confirm-remove-phone"><i class="fa-solid fa-trash-can"></i>Remove Phone</button>
                            <button class="user-button" id="cancel-remove-phone" style="justify-content: center;">Keep Phone</button>
                        </div>
                    </div>`);
                document.getElementById('confirm-remove-phone')?.addEventListener('click', async () => {
                    this.cb.hideModal();
                    this.cb.setLoading(true, "Removing", "PHONE SECURITY");
                    try {
                        const res = await (window as any).api.removePhone();
                        if (res.success) {
                            await (window as any).api.logoutWhatsApp();
                            this.cb.showToast("Phone number removed & WhatsApp disconnected", "success");
                            this.updateAccountView();
                        } else {
                            this.cb.showToast(res.message, "error");
                        }
                    } finally {
                        this.cb.setLoading(false);
                    }
                });
                document.getElementById('cancel-remove-phone')?.addEventListener('click', () => this.cb.hideModal());
            };
        }
    }

    async handleEmailVerification() {
        const digits = document.querySelectorAll('.email-verify-digit') as NodeListOf<HTMLInputElement>;
        const code = Array.from(digits).map(i => i.value).join('');
        const err = document.getElementById('email-verify-error');
        if (code.length < 6) return;
        this.cb.setLoading(true, "Verifying", "FINALIZING EMAIL IDENTITY");
        try {
            const res = await (window as any).api.confirmEmailChange(code);
            if (res.success) {
                const modal = document.getElementById('modal-email-verify');
                if (modal) { modal.classList.remove('show'); setTimeout(() => modal.classList.add('hidden'), 300); }
                await this.loadAccountInfo();
                this.cb.showToast("Email updated!", "success");
                digits.forEach(i => i.value = '');
            } else {
                if (err) { err.textContent = res.message; err.classList.remove('opacity-0'); setTimeout(() => err.classList.add('opacity-0'), 3000); }
                digits.forEach(i => i.value = '');
                digits[0].focus();
            }
        } finally { this.cb.setLoading(false); }
    }

    startEmailResendTimer() {
        if (this.emailResendInterval) clearInterval(this.emailResendInterval);
        this.emailResendTimer = 30;
        this.updateResendBtnUI();
        this.emailResendInterval = setInterval(() => {
            this.emailResendTimer--;
            this.updateResendBtnUI();
            if (this.emailResendTimer <= 0) clearInterval(this.emailResendInterval);
        }, 1000);
    }

    updateResendBtnUI() {
        const btn = document.getElementById('btn-resend-email-code') as HTMLButtonElement;
        const timerText = document.getElementById('email-resend-timer');
        if (!btn || !timerText) return;
        if (this.emailResendTimer > 0) { btn.disabled = true; timerText.textContent = `(${this.emailResendTimer}s)`; }
        else { btn.disabled = false; timerText.textContent = ''; }
    }

    showPhoneQrModal() {
        const modal = document.getElementById('modal-phone-qr');
        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.add('show'), 10);
            (window as any).api.startWhatsAppLinking();
            this.initWhatsAppLinking();
        }
    }

    hidePhoneQrModal() {
        const modal = document.getElementById('modal-phone-qr');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.classList.add('hidden');
                document.getElementById('wa-qr-error')?.classList.add('hidden');
                document.getElementById('wa-qr-overlay')?.classList.add('hidden');
            }, 300);
        }
        // Stop the WA client and clean up IPC listeners
        (window as any).api.stopWhatsApp();
        this.waListenerCleanups.forEach(fn => fn());
        this.waListenerCleanups = [];
    }

    initPhoneSecurity() {
        // Handled via listeners and updateAccountView
    }

    initWhatsAppLinking() {
        // Remove any previously registered WA listeners to prevent duplicates
        this.waListenerCleanups.forEach(fn => fn());
        this.waListenerCleanups = [];

        const modalStatusText = document.getElementById('modal-wa-status');
        const modalQrImage = document.getElementById('modal-wa-qr-image') as HTMLImageElement;
        const modalLoader = document.getElementById('modal-wa-loader');
        const modalQrOverlay = document.getElementById('wa-qr-overlay');
        const modalQrError = document.getElementById('wa-qr-error');
        const modalQrErrorText = document.getElementById('wa-qr-error-text');

        const checkAndVerifyPhone = async (waNumber: string) => {
            (window as any).api.logToMain(`[UI] WhatsApp READY. Received Number: ${waNumber}.`);
            try {
                const user = await (window as any).api.getCurrentUser();
                if (user?.pendingPhone) {
                    const res = await (window as any).api.verifyPhoneByWhatsAppMatch(waNumber);
                    if (res.success) {
                        this.cb.showToast("Phone Verified!", "success");
                        this.hidePhoneQrModal();
                        this.updateAccountView();
                    } else {
                        if (modalQrOverlay) modalQrOverlay.classList.add('hidden');
                        if (modalQrError && modalQrErrorText) {
                            modalQrErrorText.textContent = "Number Mismatch! Please scan with the WhatsApp account matching your entered phone number.";
                            modalQrError.classList.remove('hidden');
                        }
                    }
                } else if (user?.isPhoneVerified) {
                    this.hidePhoneQrModal();
                }
            } catch (err: any) {
                (window as any).api.logToMain(`[UI] Critical error during phone verification check: ${err.message || err}`);
            }
        };

        const updateUI = (status: { ready: boolean, qr: string | null, initializing?: boolean, authenticated?: boolean, waNumber?: string }) => {
            if (!status.ready && !status.authenticated) modalQrError?.classList.add('hidden');
            if (status.authenticated) {
                modalQrOverlay?.classList.remove('hidden');
                if (modalStatusText) modalStatusText.textContent = "VERIFYING IDENTITY";
            } else if (status.ready) {
                if (status.waNumber) checkAndVerifyPhone(status.waNumber);
            } else if (status.initializing || !status.qr) {
                modalLoader?.classList.remove('hidden');
                modalQrImage?.classList.add('hidden');
                modalQrOverlay?.classList.add('hidden');
                if (modalStatusText) modalStatusText.textContent = "INITIALIZING...";
            } else if (status.qr) {
                if (modalQrImage) modalQrImage.src = status.qr;
                modalLoader?.classList.add('hidden');
                modalQrImage?.classList.remove('hidden');
                modalQrOverlay?.classList.add('hidden');
                if (modalStatusText) modalStatusText.textContent = "SCAN QR CODE";
            }
        };

        // Fetch current status immediately
        (window as any).api.getWaStatus().then(updateUI);

        // Register listeners and track their removers
        const api = (window as any).api;
        const onInit    = () => updateUI({ ready: false, qr: null, initializing: true });
        const onQr      = (qr: string) => updateUI({ ready: false, qr });
        const onAuth    = () => updateUI({ ready: false, qr: null, authenticated: true });
        const onReady   = (waNumber?: string) => updateUI({ ready: true, qr: null, waNumber });
        const onFailure = (err: string) => {
            if (modalStatusText) modalStatusText.textContent = "AUTH FAILURE";
            this.cb.showToast(`WhatsApp Error: ${err}`, "error");
        };

        api.onWaInitializing(onInit);
        api.onWaQrCode(onQr);
        api.onWaAuthenticated(onAuth);
        api.onWaReady(onReady);
        api.onWaAuthFailure(onFailure);

        // Store cleanup functions (ipcRenderer.removeListener equivalents via preload)
        this.waListenerCleanups = [
            () => api.offWaInitializing?.(onInit),
            () => api.offWaQrCode?.(onQr),
            () => api.offWaAuthenticated?.(onAuth),
            () => api.offWaReady?.(onReady),
            () => api.offWaAuthFailure?.(onFailure),
        ];
    }

    private accountEventsSetup = false;

    setupAccountEvents() {
        if (this.accountEventsSetup) return;
        this.accountEventsSetup = true;

        document.getElementById('form-change-username')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = (document.getElementById('new-username') as HTMLInputElement).value.trim();
            if (newName.length < 4) return;
            this.cb.setLoading(true, "Updating Identity", "SECURE VAULT RENAMING");
            try {
                const res = await (window as any).api.changeUsername(newName);
                if (res.success) {
                    this.cb.showToast("Name updated!", "success");
                    await this.loadAccountInfo();
                    const userNameDisp = document.getElementById('user-name-display');
                    if (userNameDisp) userNameDisp.textContent = newName;
                    const dropUserName = document.getElementById('dropdown-user-name');
                    if (dropUserName) dropUserName.textContent = newName;
                } else { this.cb.showToast(res.message, "error"); }
            } finally { this.cb.setLoading(false); }
        });

        document.getElementById('btn-change-avatar')?.addEventListener('click', async () => {
            const user = await (window as any).api.getCurrentUser();
            if (user?.isLocal) { this.cb.showToast("Avatar upload is not available for local accounts", "info"); return; }
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'image/png, image/jpeg, image/webp';
            input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) { this.cb.showToast('Image must be less than 2MB', 'error'); return; }
                this.cb.setLoading(true, "Updating Profile", "UPLOADING AVATAR");
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64 = e.target?.result as string;
                    try {
                        const res = await (window as any).api.updateProfilePicture(base64);
                        if (res.success) { this.cb.showToast(res.message, 'success'); await this.loadAccountInfo(); }
                        else { this.cb.showToast(res.message, 'error'); }
                    } catch (err: any) { this.cb.showToast(err.message || "Failed to update profile picture", 'error'); }
                    finally { this.cb.setLoading(false); }
                };
                reader.onerror = () => { this.cb.showToast("Failed to read image file", 'error'); this.cb.setLoading(false); };
                reader.readAsDataURL(file);
            };
            input.click();
        });

        document.getElementById('form-request-email-change')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = await (window as any).api.getCurrentUser();
            if (user?.isLocal) { this.cb.showToast("Email change is not available for local accounts", "info"); return; }
            const newEmail = (document.getElementById('new-email') as HTMLInputElement).value.trim();
            if (!newEmail) return;
            this.cb.setLoading(true, "Requesting Change", "INITIATING EMAIL ROTATION");
            try {
                const res = await (window as any).api.requestEmailChange(newEmail);
                if (res.success) {
                    this.cb.showToast("Confirmation code sent!", "success");
                    const modal = document.getElementById('modal-email-verify');
                    if (modal) { modal.classList.remove('hidden'); modal.classList.add('show'); }
                    this.startEmailResendTimer();
                    await this.loadAccountInfo();
                } else { this.cb.showToast(res.message, "error"); }
            } finally { this.cb.setLoading(false); }
        });

        document.getElementById('btn-show-email-verify')?.addEventListener('click', async () => {
            const user = await (window as any).api.getCurrentUser();
            if (user?.isLocal) { this.cb.showToast("Email verification is not available for local accounts", "info"); return; }
            this.cb.setLoading(true, "Requesting Code", "ROTATING VERIFICATION KEY");
            try {
                const res = await (window as any).api.resendEmailChangeCode();
                if (res.success) {
                    const modal = document.getElementById('modal-email-verify');
                    if (modal) { modal.classList.remove('hidden'); modal.classList.add('show'); }
                    this.startEmailResendTimer();
                    this.cb.showToast("New code sent", "success");
                } else { this.cb.showToast(res.message, "error"); }
            } finally { this.cb.setLoading(false); }
        });

        document.getElementById('form-request-phone-verification')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = await (window as any).api.getCurrentUser();
            if (user?.isLocal) { this.cb.showToast("Phone verification is not available for local accounts", "info"); return; }
            const phone = (document.getElementById('new-phone') as HTMLInputElement).value.trim();
            if (!phone) return;
            const phoneRegex = /^\+[0-9]{8,15}$/;
            if (!phoneRegex.test(phone)) { this.cb.showToast("Invalid format. Use + and 8-15 digits (e.g. +123456789).", "error"); return; }
            this.cb.setLoading(true, "Saving", "PHONE SECURITY");
            try {
                const res = await (window as any).api.requestPhoneVerification(phone);
                if (res.success) { this.cb.showToast("Number saved! Please scan to verify.", "success"); this.updateAccountView(); this.showPhoneQrModal(); }
                else { this.cb.showToast(res.message, "error"); }
            } finally { this.cb.setLoading(false); }
        });

        document.getElementById('btn-cancel-phone-qr')?.addEventListener('click', () => this.hidePhoneQrModal());

        document.getElementById('btn-cancel-email-modal')?.addEventListener('click', () => {
            const modal = document.getElementById('modal-email-verify');
            if (modal) { modal.classList.remove('show'); setTimeout(() => modal.classList.add('hidden'), 300); }
        });

        const digits = document.querySelectorAll('.email-verify-digit') as NodeListOf<HTMLInputElement>;
        digits.forEach((input, idx) => {
            input.addEventListener('input', () => {
                if (input.value && digits[idx + 1]) digits[idx + 1].focus();
                if (Array.from(digits).every(i => i.value)) this.handleEmailVerification();
            });
            input.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !input.value && digits[idx - 1]) digits[idx - 1].focus(); });
        });

        document.getElementById('btn-confirm-email-change')?.addEventListener('click', () => this.handleEmailVerification());

        document.getElementById('btn-resend-email-code')?.addEventListener('click', async () => {
            if (this.emailResendTimer > 0) return;
            try {
                const res = await (window as any).api.resendEmailChangeCode();
                if (res.success) { this.cb.showToast("New code sent", "success"); this.startEmailResendTimer(); }
            } catch (e) { this.cb.showToast("Failed to resend code", "error"); }
        });

        document.getElementById('btn-cancel-email-change')?.addEventListener('click', async () => {
            const user = await (window as any).api.getCurrentUser();
            if (user?.isLocal) return;
            this.cb.setLoading(true, "Cancelling", "REVERTING IDENTITY CHANGES");
            try { await (window as any).api.cancelEmailChange(); await this.loadAccountInfo(); this.cb.showToast("Email change cancelled", "info"); }
            finally { this.cb.setLoading(false); }
        });

        document.getElementById('form-change-password')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPass = (document.getElementById('new-master-password') as HTMLInputElement).value;
            const confPass = (document.getElementById('confirm-master-password') as HTMLInputElement).value;
            if (newPass !== confPass) { this.cb.showToast("Passwords do not match", "error"); return; }
            if (newPass.length < 8) { this.cb.showToast("Password too short", "error"); return; }
            this.cb.setLoading(true, "Re-encrypting Vault", "MASTER KEY ROTATION IN PROGRESS");
            try {
                const res = await (window as any).api.changePassword(newPass);
                if (res.success) {
                    this.cb.showToast("Password updated!", "success");
                    (document.getElementById('new-master-password') as HTMLInputElement).value = '';
                    (document.getElementById('confirm-master-password') as HTMLInputElement).value = '';
                } else { this.cb.showToast(res.message, "error"); }
            } finally { this.cb.setLoading(false); }
        });

        document.getElementById('btn-refresh-devices')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-refresh-devices');
            if (btn) btn.classList.add('spinning');
            await this.loadDevices();
            if (btn) btn.classList.remove('spinning');
        });
    }

    async loadDevices() {
        const list = document.getElementById('devices-list');
        if (!list) return;

        const user = await (window as any).api.getCurrentUser();
        if (!user || user.isLocal) return;

        const currentDeviceId: string | null = await (window as any).api.getCurrentDeviceId();
        const devices: any[] = user.devices || [];

        if (devices.length === 0) {
            list.innerHTML = `<p style="font-size:12px;opacity:0.5;font-weight:600;text-align:center;padding:12px 0;">No devices recorded yet.</p>`;
            return;
        }

        // Sort: current device first, then by lastSeen desc
        const sorted = [...devices].sort((a, b) => {
            if (a.id === currentDeviceId) return -1;
            if (b.id === currentDeviceId) return 1;
            return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
        });

        list.innerHTML = sorted.map(device => {
            const isCurrent = device.id === currentDeviceId;
            const platformIcon = device.platform === 'darwin' ? 'fa-apple' :
                                 device.platform === 'linux'  ? 'fa-linux' : 'fa-windows';
            const lastSeen = this.formatRelativeTime(new Date(device.lastSeen));
            const firstSeen = new Date(device.firstSeen).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

            return `
            <div class="device-row" data-device-id="${device.id}">
                <div class="device-icon-vessel">
                    <i class="fa-brands ${platformIcon}"></i>
                </div>
                <div class="device-info">
                    <div class="device-name">
                        ${device.name}
                        ${isCurrent ? '<span class="device-current-badge">This Device</span>' : ''}
                    </div>
                    <div class="device-meta">
                        <span>First seen ${firstSeen}</span>
                        <span class="device-meta-dot">·</span>
                        <span>Active ${lastSeen}</span>
                    </div>
                </div>
                ${!isCurrent ? `
                <button class="device-revoke-btn" data-device-id="${device.id}" title="Revoke access">
                    <i class="fa-solid fa-xmark"></i>
                </button>` : ''}
            </div>
            ${!isCurrent ? `
            <div class="device-revoke-confirm hidden" data-confirm-id="${device.id}">
                <span class="device-revoke-confirm-text">Log out &amp; remove this device?</span>
                <div class="device-revoke-confirm-actions">
                    <button class="device-confirm-cancel" data-confirm-id="${device.id}">Cancel</button>
                    <button class="device-confirm-ok" data-confirm-id="${device.id}">Remove</button>
                </div>
            </div>` : ''}`;
        }).join('');

        // Revoke button — show inline confirm
        list.querySelectorAll('.device-revoke-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const deviceId = (btn as HTMLElement).dataset.deviceId!;
                const confirm = list.querySelector(`.device-revoke-confirm[data-confirm-id="${deviceId}"]`);
                confirm?.classList.remove('hidden');
            });
        });

        // Cancel confirm
        list.querySelectorAll('.device-confirm-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const deviceId = (btn as HTMLElement).dataset.confirmId!;
                const confirm = list.querySelector(`.device-revoke-confirm[data-confirm-id="${deviceId}"]`);
                confirm?.classList.add('hidden');
            });
        });

        // Confirm revoke
        list.querySelectorAll('.device-confirm-ok').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const deviceId = (btn as HTMLElement).dataset.confirmId!;
                this.cb.setLoading(true, "Revoking Device", "UPDATING SECURITY");
                try {
                    const res = await (window as any).api.revokeDevice(deviceId);
                    if (res.success) {
                        this.cb.showToast("Device removed and logged out remotely", "success");
                        await this.loadDevices();
                    } else {
                        this.cb.showToast(res.message || "Failed to remove device", "error");
                    }
                } finally {
                    this.cb.setLoading(false);
                }
            });
        });
    }

    private formatRelativeTime(date: Date): string {
        const diffMs = Date.now() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHrs = Math.floor(diffMin / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        return diffDays === 1 ? 'yesterday' : `${diffDays}d ago`;
    }
}
