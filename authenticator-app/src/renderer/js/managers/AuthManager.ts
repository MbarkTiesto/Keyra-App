import { rateLimiter } from '../../../core/rateLimiter.js';

export interface AuthCallbacks {
    getUserId: () => string;
    getStorageKey: (key: string) => string;
    showToast: (msg: string, type: 'info' | 'success' | 'error') => void;
    setLoading: (show: boolean, title?: string, subtitle?: string) => void;
    showModal: (content: string) => void;
    hideModal: () => void;
    showStaticModal: (id: string) => void;
    pushSettings: () => Promise<any>;
    updateLockVaultVisibility: () => void;
    updatePinStatus: () => void;
    updateSyncIndicator: (state: string) => void;
    setSyncVisible: (visible: boolean) => void;
    formatSyncTime: (date: Date) => string;
}

export class AuthManager {
    private emailResendTimer: number = 0;
    private emailResendInterval: any = null;

    constructor(private cb: AuthCallbacks) {}

    async initFromCloud() {
        const user = await (window as any).api.getCurrentUser();
        if (user) {
            const desktopSettings = user["Desktop Settings"] || user.settings || {};
            return desktopSettings;
        }
        return null;
    }

    async migratePin() {
        const pin = localStorage.getItem(this.cb.getStorageKey('vault_pin'));
        if (pin && pin.length === 4 && /^\d+$/.test(pin)) {
            console.log("Migrating legacy plaintext PIN to encrypted storage...");
            try {
                const encrypted = await (window as any).api.encryptPIN(pin);
                localStorage.setItem(this.cb.getStorageKey('vault_pin'), encrypted);
                await this.cb.pushSettings();
                console.log("PIN migration successful");
            } catch (e) {
                console.error("PIN migration failed", e);
            }
        }
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
        if (user.pendingEmail) {
            badge?.classList.remove('hidden');
            if (badge) {
                badge.textContent = 'NOT VERIFIED';
                badge.style.background = 'rgba(255, 59, 48, 0.1)';
                badge.style.color = '#ff3b30';
                badge.style.border = '1px solid rgba(255, 59, 48, 0.2)';
                badge.style.fontSize = '10px';
                badge.style.fontWeight = '850';
                badge.style.padding = '4px 10px';
                badge.style.borderRadius = '20px';
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
            if (user.privateSync && user.privateSync.pat) {
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
            if (syncTitle) syncTitle.textContent = "Cloud Sync";
            if (syncSubtitle) syncSubtitle.textContent = "Keep your Vault safe on GitHub";
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
        if (emailDisplay) emailDisplay.textContent = user.email;
        if (initials) initials.textContent = user.username.charAt(0).toUpperCase();

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
            if (phoneBadge) { phoneBadge.textContent = "SECURE"; phoneBadge.className = "badge success"; phoneBadge.style.background = "rgba(40, 167, 69, 0.1)"; phoneBadge.style.color = "#28a745"; phoneBadge.style.border = "1px solid rgba(40, 167, 69, 0.2)"; }
            phoneActionBox?.classList.add('hidden');
            requestForm?.classList.add('hidden');
            removeBtn?.classList.remove('hidden');
        } else if (user.pendingPhone) {
            if (phoneDisplay) phoneDisplay.textContent = user.pendingPhone;
            if (phoneStatusText) phoneStatusText.textContent = "AWAITING VERIFICATION";
            if (phoneBadge) { phoneBadge.textContent = "PENDING"; phoneBadge.style.color = "#007aff"; phoneBadge.style.border = "1px solid rgba(0, 122, 255, 0.2)"; }
            phoneActionBox?.classList.remove('hidden');
            const verifyNowBtn = document.getElementById('btn-verify-now');
            if (verifyNowBtn) verifyNowBtn.onclick = () => this.showPhoneQrModal();
            requestForm?.classList.add('hidden');
            removeBtn?.classList.remove('hidden');
        } else {
            if (phoneDisplay) phoneDisplay.textContent = "No Phone Set";
            if (phoneStatusText) phoneStatusText.textContent = "NOT VERIFIED";
            if (phoneBadge) { phoneBadge.textContent = "UNPROTECTED"; phoneBadge.className = "badge danger"; phoneBadge.style.background = "rgba(255, 59, 48, 0.1)"; phoneBadge.style.color = "#ff3b30"; phoneBadge.style.border = "1px solid rgba(255, 59, 48, 0.2)"; }
            phoneActionBox?.classList.add('hidden');
            requestForm?.classList.remove('hidden');
            removeBtn?.classList.add('hidden');
        }

        if (removeBtn) {
            removeBtn.onclick = async () => {
                if (confirm("Are you sure you want to remove your phone number? This will disable dual-channel protection.")) {
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
                }
            };
        }
    }

    async lockVault() {
        const vessel = document.getElementById('lock-vessel');
        if (!vessel) return;
        try {
            const user = await (window as any).api.getCurrentUser();
            if (user) {
                const pinAvatarImg = document.getElementById('pin-avatar-img') as HTMLImageElement;
                const pinAvatarFallback = document.getElementById('pin-avatar-fallback') as HTMLImageElement;
                const pinGreeting = document.getElementById('pin-greeting');
                if (pinAvatarImg && pinAvatarFallback) {
                    if (user.profilePicture) { pinAvatarImg.src = user.profilePicture; pinAvatarImg.classList.remove('hidden'); pinAvatarFallback.classList.add('hidden'); }
                    else { pinAvatarImg.classList.add('hidden'); pinAvatarFallback.classList.remove('hidden'); }
                }
                if (pinGreeting) pinGreeting.textContent = `Welcome back, ${user.username.split(' ')[0]}`;
            }
        } catch (e) { console.error("Failed to load user for lock screen:", e); }

        vessel.classList.add('show');
        document.body.classList.add('vault-is-locked');
        const pinIn = document.getElementById('unlock-pin') as HTMLInputElement;
        const dots = vessel.querySelectorAll('.pin-dot');
        const forgotPinBtn = document.getElementById('btn-forgot-pin') as HTMLButtonElement;
        const blockedStatus = document.getElementById('pin-blocked-status');
        const blockedText = document.getElementById('pin-blocked-text');
        const pinHelper = vessel.querySelector('.pin-helper') as HTMLElement;

        const rateLimitCheck = rateLimiter.isAllowed('pin', this.cb.getUserId());
        if (!rateLimitCheck.allowed) {
            if (pinIn) { pinIn.disabled = true; pinIn.value = ''; pinIn.placeholder = ''; }
            dots.forEach(dot => { dot.classList.remove('filled', 'success', 'error'); dot.classList.add('blocked'); });
            if (forgotPinBtn) { forgotPinBtn.disabled = true; forgotPinBtn.style.opacity = '0.3'; forgotPinBtn.style.cursor = 'not-allowed'; }
            if (blockedStatus && blockedText && rateLimitCheck.blockMinutes) {
                blockedText.textContent = `Blocked for ${rateLimitCheck.blockMinutes} minute${rateLimitCheck.blockMinutes > 1 ? 's' : ''}`;
                blockedStatus.classList.remove('hidden');
                if (pinHelper) pinHelper.style.display = 'none';
            }
            this.cb.showToast(rateLimitCheck.message || "Too many attempts", "error");
            if (rateLimitCheck.blockMinutes) {
                setTimeout(() => {
                    if (pinIn) { pinIn.disabled = false; pinIn.placeholder = ''; pinIn.focus(); }
                    dots.forEach(dot => dot.classList.remove('blocked'));
                    if (forgotPinBtn) { forgotPinBtn.disabled = false; forgotPinBtn.style.opacity = ''; forgotPinBtn.style.cursor = ''; }
                    if (blockedStatus) blockedStatus.classList.add('hidden');
                    if (pinHelper) pinHelper.style.display = '';
                    this.cb.showToast("You can try again now", "info");
                }, rateLimitCheck.blockMinutes * 60 * 1000);
            }
        } else {
            if (pinIn) { pinIn.disabled = false; pinIn.value = ''; setTimeout(() => pinIn.focus(), 100); }
            dots.forEach(dot => dot.classList.remove('filled', 'success', 'error', 'blocked'));
            if (forgotPinBtn) { forgotPinBtn.disabled = false; forgotPinBtn.style.opacity = ''; forgotPinBtn.style.cursor = ''; }
            if (blockedStatus) blockedStatus.classList.add('hidden');
            if (pinHelper) pinHelper.style.display = '';
        }
    }

    handleUnlock() {
        const pinIn = document.getElementById('unlock-pin') as HTMLInputElement;
        if (pinIn) this.validateAndAutoUnlock(pinIn.value);
    }

    async validateAndAutoUnlock(pinValue: string) {
        const saved = localStorage.getItem(this.cb.getStorageKey('vault_pin'));
        const lockVessel = document.getElementById('lock-vessel');
        const dots = lockVessel?.querySelectorAll('.pin-dot');
        const pinInput = document.getElementById('unlock-pin') as HTMLInputElement;
        const forgotPinBtn = document.getElementById('btn-forgot-pin') as HTMLButtonElement;
        const blockedStatus = document.getElementById('pin-blocked-status');
        const blockedText = document.getElementById('pin-blocked-text');
        const pinHelper = lockVessel?.querySelector('.pin-helper') as HTMLElement;

        const rateLimitCheck = rateLimiter.isAllowed('pin', this.cb.getUserId());
        if (!rateLimitCheck.allowed) {
            if (pinInput) { pinInput.disabled = true; pinInput.value = ''; pinInput.placeholder = ''; }
            if (dots) dots.forEach(dot => { dot.classList.remove('filled', 'error', 'success'); dot.classList.add('blocked'); });
            if (forgotPinBtn) { forgotPinBtn.disabled = true; forgotPinBtn.style.opacity = '0.3'; forgotPinBtn.style.cursor = 'not-allowed'; }
            if (blockedStatus && blockedText && rateLimitCheck.blockMinutes) {
                blockedText.textContent = `Blocked for ${rateLimitCheck.blockMinutes} minute${rateLimitCheck.blockMinutes > 1 ? 's' : ''}`;
                blockedStatus.classList.remove('hidden');
                if (pinHelper) pinHelper.style.display = 'none';
            }
            this.cb.showToast(rateLimitCheck.message || "Too many attempts", "error");
            if (rateLimitCheck.blockMinutes) {
                setTimeout(() => {
                    if (pinInput) { pinInput.disabled = false; pinInput.placeholder = ''; pinInput.focus(); }
                    if (dots) dots.forEach(dot => dot.classList.remove('blocked'));
                    if (forgotPinBtn) { forgotPinBtn.disabled = false; forgotPinBtn.style.opacity = ''; forgotPinBtn.style.cursor = ''; }
                    if (blockedStatus) blockedStatus.classList.add('hidden');
                    if (pinHelper) pinHelper.style.display = '';
                    this.cb.showToast("You can try again now", "info");
                }, rateLimitCheck.blockMinutes * 60 * 1000);
            }
            return;
        }

        if (dots) dots.forEach((dot, i) => dot.classList.toggle('filled', i < pinValue.length));

        if (pinValue.length === 4) {
            let isCorrect = false;
            try {
                if (saved) {
                    if (saved.length === 4 && /^\d+$/.test(saved)) {
                        isCorrect = (pinValue === saved);
                    } else {
                        const decrypted = await (window as any).api.decryptPIN(saved);
                        isCorrect = (pinValue === decrypted);
                    }
                }
            } catch (e) { console.error("PIN Decryption failed during unlock", e); }

            if (isCorrect) {
                rateLimiter.reset('pin', this.cb.getUserId());
                if (dots) dots.forEach(dot => dot.classList.add('success'));
                setTimeout(() => {
                    document.getElementById('lock-vessel')?.classList.remove('show');
                    document.body.classList.remove('vault-is-locked');
                    if (pinInput) pinInput.value = '';
                    if (dots) dots.forEach(dot => dot.classList.remove('filled', 'success'));
                }, 500);
                this.cb.showToast("Vault unlocked!", "success");
                this.updateLastActivity('Vault unlocked');
            } else {
                rateLimiter.recordAttempt('pin', this.cb.getUserId());
                const remaining = rateLimiter.getRemainingAttempts('pin', this.cb.getUserId());
                if (dots) dots.forEach(dot => dot.classList.add('error'));
                setTimeout(() => {
                    if (pinInput) pinInput.value = '';
                    if (dots) dots.forEach(dot => dot.classList.remove('filled', 'error'));
                }, 800);
                let errorMsg = "Incorrect PIN";
                if (remaining > 0 && remaining <= 3) errorMsg += ` (${remaining} attempt${remaining > 1 ? 's' : ''} remaining)`;
                else if (remaining === 0) { errorMsg = "Too many attempts. Blocked for 10 minutes."; setTimeout(() => this.validateAndAutoUnlock(''), 100); }
                this.cb.showToast(errorMsg, "error");
            }
        }
    }

    clearPinInput() {
        const pinIn = document.getElementById('unlock-pin') as HTMLInputElement;
        if (pinIn) { pinIn.value = ''; pinIn.focus(); }
        document.querySelectorAll('.pin-dot').forEach(dot => dot.classList.remove('filled', 'error', 'success'));
    }

    updateLockVaultVisibility() {
        this.cb.updateLockVaultVisibility();
    }

    updatePinStatus() {
        this.cb.updatePinStatus();
    }

    async verifyCurrentPin(onSuccess: () => void) {
        const storedPin = localStorage.getItem(this.cb.getStorageKey('vault_pin'));
        if (!storedPin) { onSuccess(); return; }

        const content = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-icon-vessel"><i class="fa-solid fa-shield-halved"></i></div>
                    <div class="modal-title-vessel"><h2>Verify Identity</h2><p>ENTER CURRENT PIN TO PROCEED</p></div>
                </div>
                <div class="modal-divider"></div>
                <div class="modal-body">
                    <div class="pin-input-vessel" style="margin: 20px 0;">
                        <input type="password" id="verify-pin-field" maxlength="4" class="pin-field" style="opacity: 0; position: absolute;" autocomplete="off" autofocus>
                        <div class="pin-indicators" style="justify-content: center;">
                            <div class="pin-dot" data-digit="1"></div>
                            <div class="pin-dot" data-digit="2"></div>
                            <div class="pin-dot" data-digit="3"></div>
                            <div class="pin-dot" data-digit="4"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 0; min-height: 48px;">
                    <button class="user-button" id="cancel-verify-btn" style="width: 100%; justify-content: center;">Cancel</button>
                </div>
            </div>`;
        this.cb.showModal(content);

        const input = document.getElementById('verify-pin-field') as HTMLInputElement;
        const modalContainer = input?.closest('.modal-content') || document;
        const dots = modalContainer.querySelectorAll('.pin-dot');
        input?.focus();

        const performVerify = async () => {
            const enteredPin = input.value;
            try {
                let isCorrect = false;
                try {
                    const decrypted = await (window as any).api.decryptPIN(storedPin);
                    isCorrect = enteredPin === decrypted;
                } catch (e) { isCorrect = enteredPin === storedPin; }
                if (isCorrect) { onSuccess(); }
                else { this.cb.showToast("Incorrect PIN", "error"); input.value = ''; dots.forEach(dot => dot.classList.remove('filled')); input.focus(); }
            } catch (e) { console.error("Verification failed", e); this.cb.showToast("Verification error", "error"); }
        };

        input?.addEventListener('input', async (e) => {
            const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
            input.value = val;
            dots.forEach((dot, i) => dot.classList.toggle('filled', i < val.length));
            if (val.length === 4) await performVerify();
        });
        input?.addEventListener('keypress', (e) => { if (e.key === 'Enter') performVerify(); });
        document.getElementById('cancel-verify-btn')?.addEventListener('click', () => this.cb.hideModal());
    }

    showPinSetup() {
        this.verifyCurrentPin(() => {
            let firstEntry = '';
            let phase: 'entry' | 'confirm' = 'entry';
            const renderModal = () => {
                const isEntry = phase === 'entry';
                const content = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-icon-vessel"><i class="fa-solid ${isEntry ? 'fa-shield-halved' : 'fa-circle-check'}"></i></div>
                            <div class="modal-title-vessel"><h2>${isEntry ? 'Set Master PIN' : 'Verify PIN'}</h2><p>${isEntry ? 'ESTABLISH 4-DIGIT VAULT KEY' : 'RE-ENTER KEY TO CONFIRM'}</p></div>
                        </div>
                        <div class="modal-divider"></div>
                        <div class="modal-body">
                            <div class="form-group">
                                <label class="form-label">${isEntry ? 'Choose New PIN' : 'Confirm New PIN'}</label>
                                <div class="pin-input-vessel" style="margin: 20px 0;">
                                    <input type="password" id="setup-pin-field" maxlength="4" class="pin-field" style="opacity: 0; position: absolute;" autocomplete="off" autofocus>
                                    <div class="pin-indicators" style="justify-content: center;">
                                        <div class="pin-dot" data-digit="1"></div><div class="pin-dot" data-digit="2"></div>
                                        <div class="pin-dot" data-digit="3"></div><div class="pin-dot" data-digit="4"></div>
                                    </div>
                                </div>
                                <p class="modal-help-text" style="text-align: center;">${isEntry ? 'Keep this code safe. It is required to unlock your identities.' : 'Passwords must match exactly to synchronize security.'}</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-primary" id="btn-next-step" disabled><i class="fa-solid ${isEntry ? 'fa-arrow-right' : 'fa-shield-halved'}"></i>${isEntry ? 'Next Phase' : 'Activate Vault'}</button>
                            <button class="user-button" id="cancel-pin-btn" style="justify-content: center;">Cancel</button>
                        </div>
                    </div>`;
                this.cb.showModal(content);
                const input = document.getElementById('setup-pin-field') as HTMLInputElement;
                const dots = (input?.closest('.modal-content') || document).querySelectorAll('.pin-dot');
                const nextBtn = document.getElementById('btn-next-step') as HTMLButtonElement;
                input?.focus();
                input?.addEventListener('input', (e) => {
                    const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
                    input.value = val;
                    dots.forEach((dot, i) => dot.classList.toggle('filled', i < val.length));
                    if (nextBtn) nextBtn.disabled = val.length !== 4;
                });
                nextBtn?.addEventListener('click', async () => {
                    if (phase === 'entry') { firstEntry = input.value; phase = 'confirm'; renderModal(); }
                    else {
                        if (input.value === firstEntry) {
                            this.cb.setLoading(true, "Securing Vault", "GENERATING MASTER KEY");
                            try {
                                const encrypted = await (window as any).api.encryptPIN(input.value);
                                localStorage.setItem(this.cb.getStorageKey('vault_pin'), encrypted);
                                this.cb.updateLockVaultVisibility();
                                this.cb.updatePinStatus();
                                this.cb.showToast("PIN set up and encrypted!", "success");
                                this.cb.hideModal();
                                this.cb.pushSettings().catch(e => console.warn("PIN sync failed", e));
                            } catch (e) { console.error("PIN Setup encryption failed", e); this.cb.showToast("Security setup failed", "error"); }
                            finally { this.cb.setLoading(false); }
                        } else { this.cb.showToast("PIN Matching Failed", "error"); phase = 'entry'; firstEntry = ''; renderModal(); }
                    }
                });
                document.getElementById('cancel-pin-btn')?.addEventListener('click', () => this.cb.hideModal());
            };
            renderModal();
        });
    }

    showRemovePinConfirm() {
        this.verifyCurrentPin(() => {
            const content = `
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-icon-vessel danger"><i class="fa-solid fa-shield-halved"></i></div>
                        <div class="modal-title-vessel"><h2 class="danger">Deactivate Security?</h2><p>VAULT WILL BE UNPROTECTED</p></div>
                    </div>
                    <div class="modal-divider"></div>
                    <div class="modal-body">
                        <div class="modal-entity-badge">
                            <div class="entity-icon"><i class="fa-solid fa-lock"></i></div>
                            <div class="entity-info"><span class="entity-name">Master PIN Policy</span><span class="entity-label">Active Protection</span></div>
                        </div>
                        <p class="modal-help-text">Removing the PIN means anyone with access to this device can view your identities. This action is immediate.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-danger" id="confirm-remove-pin"><i class="fa-solid fa-trash-can"></i>Remove Security</button>
                        <button class="user-button" id="cancel-remove-pin" style="justify-content: center;">Keep PIN Active</button>
                    </div>
                </div>`;
            this.cb.showModal(content);
            document.getElementById('confirm-remove-pin')?.addEventListener('click', async () => {
                this.cb.setLoading(true, "Removing Security", "DEACTIVATING MASTER KEY");
                try {
                    localStorage.removeItem(this.cb.getStorageKey('vault_pin'));
                    this.cb.updateLockVaultVisibility();
                    this.cb.updatePinStatus();
                    this.cb.showToast("Security code removed", "info");
                    this.cb.hideModal();
                    this.cb.pushSettings().catch(e => console.warn("PIN removal sync failed", e));
                } finally { this.cb.setLoading(false); }
            });
            document.getElementById('cancel-remove-pin')?.addEventListener('click', () => this.cb.hideModal());
        });
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
    }

    initPhoneSecurity() {
        // Handled via listeners and updateAccountView
    }

    initWhatsAppLinking() {
        const modalStatusText = document.getElementById('modal-wa-status');
        const modalQrImage = document.getElementById('modal-wa-qr-image') as HTMLImageElement;
        const modalLoader = document.getElementById('modal-wa-loader');
        const modalQrOverlay = document.getElementById('wa-qr-overlay');
        const modalQrError = document.getElementById('wa-qr-error');
        const modalQrErrorText = document.getElementById('wa-qr-error-text');

        const checkAndVerifyPhone = async (waNumber: string) => {
            (window as any).api.logToMain(`[UI] WhatsApp READY. Received Number: ${waNumber}. Waiting 200ms for data sync...`);
            await new Promise(resolve => setTimeout(resolve, 200));
            try {
                const user = await (window as any).api.getCurrentUser();
                if (user?.pendingPhone) {
                    const res = await (window as any).api.verifyPhoneByWhatsAppMatch(waNumber);
                    if (res.success) { this.cb.showToast("Phone Verified! 🚀", "success"); this.hidePhoneQrModal(); this.updateAccountView(); }
                    else {
                        if (modalQrOverlay) modalQrOverlay.classList.add('hidden');
                        if (modalQrError && modalQrErrorText) { modalQrErrorText.textContent = "Number Mismatch! Please scan with the WhatsApp account matching your entered phone number."; modalQrError.classList.remove('hidden'); }
                    }
                } else if (user?.isPhoneVerified) { this.hidePhoneQrModal(); }
            } catch (err: any) { (window as any).api.logToMain(`[UI] Critical error during phone verification check: ${err.message || err}`); }
        };

        const updateUI = (status: { ready: boolean, qr: string | null, initializing?: boolean, authenticated?: boolean, waNumber?: string }) => {
            if (!status.ready && !status.authenticated) modalQrError?.classList.add('hidden');
            if (status.authenticated) { modalQrOverlay?.classList.remove('hidden'); if (modalStatusText) modalStatusText.textContent = "VERIFYING IDENTITY"; }
            else if (status.ready) { if (status.waNumber) checkAndVerifyPhone(status.waNumber); }
            else if (status.initializing || !status.qr) { modalLoader?.classList.remove('hidden'); modalQrImage?.classList.add('hidden'); modalQrOverlay?.classList.add('hidden'); if (modalStatusText) modalStatusText.textContent = "INITIALIZING..."; }
            else if (status.qr) { if (modalQrImage) modalQrImage.src = status.qr; modalLoader?.classList.add('hidden'); modalQrImage?.classList.remove('hidden'); modalQrOverlay?.classList.add('hidden'); if (modalStatusText) modalStatusText.textContent = "SCAN QR CODE"; }
        };

        (window as any).api.getWaStatus().then(updateUI);
        (window as any).api.onWaInitializing(() => updateUI({ ready: false, qr: null, initializing: true }));
        (window as any).api.onWaQrCode((qr: string) => updateUI({ ready: false, qr }));
        (window as any).api.onWaAuthenticated(() => updateUI({ ready: false, qr: null, authenticated: true }));
        (window as any).api.onWaReady(async (waNumber?: string) => updateUI({ ready: true, qr: null, waNumber }));
        (window as any).api.onWaAuthFailure((err: string) => { if (modalStatusText) modalStatusText.textContent = "AUTH FAILURE"; this.cb.showToast(`WhatsApp Error: ${err}`, "error"); });
    }

    setupAccountEvents() {
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

        document.getElementById('btn-change-avatar')?.addEventListener('click', () => {
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
            const phone = (document.getElementById('new-phone') as HTMLInputElement).value.trim();
            if (!phone) return;
            const phoneRegex = /^\+[0-9]{8,15}$/;
            if (!phoneRegex.test(phone)) { this.cb.showToast("Invalid format. Use + and 8-15 digits (e.g. +123456789).", "error"); return; }
            this.cb.setLoading(true, "Saving", "PHONE SECURITY");
            try {
                const lastInit = (window as any)._lastWaInit || 0;
                if (Date.now() - lastInit < 2000) { this.cb.setLoading(true, "Wait...", "INITIALIZING"); await new Promise(resolve => setTimeout(resolve, 2000)); }
                (window as any)._lastWaInit = Date.now();
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
    }

    maskPhoneNumber(phone: string): string {
        if (!phone) return 'XX XXX XX';
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 2) return phone;
        return `XXXX XXX XX${digits.slice(-2)}`;
    }

    showForgotPinConfirm() {
        console.log("[UI] Showing Forgot PIN modal...");
        const modal = document.getElementById('modal-forgot-pin');
        if (!modal) {
            console.error("[UI] Forgot PIN modal NOT FOUND!");
            return;
        }

        const mainView = document.getElementById('forgot-pin-main-view');
        const waView = document.getElementById('forgot-pin-wa-view');
        const codeView = document.getElementById('forgot-pin-code-view');

        const showView = (view: 'main' | 'wa' | 'code') => {
            mainView?.classList.toggle('hidden', view !== 'main');
            waView?.classList.toggle('hidden', view !== 'wa');
            codeView?.classList.toggle('hidden', view !== 'code');
        };

        showView('main');

        const passwordInput = document.getElementById('forgot-pin-password') as HTMLInputElement;
        const passForm = document.getElementById('form-forgot-pin');
        const confirmBtn = document.getElementById('confirm-forgot-pin-btn');
        const codeInput = document.getElementById('forgot-pin-verify-code') as HTMLInputElement;

        if (passwordInput) passwordInput.value = '';
        if (codeInput) codeInput.value = '';
        passForm?.classList.add('hidden');
        if (confirmBtn) confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Reset PIN & Sign Out';

        document.querySelectorAll('#modal-forgot-pin .hidden[id$="-error"]').forEach(el => el.classList.add('hidden'));

        modal.classList.remove('hidden');
        modal.classList.add('show');
        modal.style.zIndex = "99999";

        const showError = (id: string, msg: string) => {
            const el = document.getElementById(id);
            if (el) { el.textContent = msg; el.classList.remove('hidden'); }
        };
        const hideError = (id: string) => {
            const el = document.getElementById(id);
            if (el) { el.textContent = ''; el.classList.add('hidden'); }
        };

        const completePinReset = async () => {
            this.cb.setLoading(true, "Resetting Security", "REMOVING PIN & SYNCING");
            localStorage.removeItem(this.cb.getStorageKey('vault_pin'));
            this.updateLockVaultVisibility();
            this.updatePinStatus();
            this.cb.pushSettings().catch(e => console.warn("PIN reset sync failed", e));
            modal.classList.remove('show');
            setTimeout(() => modal.classList.add('hidden'), 300);
            this.cb.setLoading(true, "Signing Out", "RETURNING TO LOGIN");
            await (window as any).api.logout();
            window.location.reload();
        };

        const confirmHandler = async (e?: Event) => {
            e?.preventDefault();
            const pForm = document.getElementById('form-forgot-pin');
            const pInput = document.getElementById('forgot-pin-password') as HTMLInputElement;
            const cBtn = document.getElementById('confirm-forgot-pin-btn');

            if (pForm?.classList.contains('hidden')) {
                pForm.classList.remove('hidden');
                if (cBtn) cBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Reset & Sign Out';
                setTimeout(() => pInput?.focus(), 100);
                return;
            }

            const password = pInput?.value || '';
            hideError('forgot-pin-error');

            if (!password) {
                showError('forgot-pin-error', 'Please enter your master password.');
                pInput?.focus();
                return;
            }

            this.cb.setLoading(true, "Verifying Identity", "CHECKING MASTER PASSWORD");
            try {
                const result = await (window as any).api.verifyMasterPassword(password);
                if (!result.success) {
                    this.cb.setLoading(false);
                    showError('forgot-pin-error', result.message || 'Incorrect password.');
                    pInput?.select();
                    return;
                }
                if (pInput) pInput.value = '';
                await completePinReset();
            } catch (err) {
                this.cb.setLoading(false);
                showError('forgot-pin-error', 'An error occurred. Please try again.');
            }
        };

        const cancelHandler = () => {
            const currentView = Array.from(modal.querySelectorAll('.modal-content')).find(v => !v.classList.contains('hidden'))?.id;

            if (currentView && currentView !== 'forgot-pin-main-view') {
                showView('main');
                passForm?.classList.add('hidden');
                if (passwordInput) passwordInput.value = '';
                if (confirmBtn) confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Reset PIN & Sign Out';
                return;
            }

            (window as any).api.clearPinResetCode();
            modal.classList.remove('show');
            setTimeout(() => modal.classList.add('hidden'), 300);
            document.getElementById('unlock-pin')?.focus();
        };

        let verifiedPhone: string | null = null;

        const startWhatsAppFlow = async () => {
            showView('wa');
            const qrImg = document.getElementById('forgot-pin-wa-qr') as HTMLImageElement;
            const loader = document.getElementById('forgot-pin-wa-loader');
            const overlay = document.getElementById('forgot-pin-wa-overlay');
            const status = document.getElementById('forgot-pin-wa-status');
            const errorEl = document.getElementById('forgot-pin-wa-error');
            const errorText = document.getElementById('forgot-pin-wa-error-text');

            loader?.classList.remove('hidden');
            qrImg?.classList.add('hidden');
            overlay?.classList.add('hidden');
            errorEl?.classList.add('hidden');
            if (status) status.textContent = 'INITIALIZING...';

            const showWaError = (msg: string) => {
                if (errorText) errorText.textContent = msg;
                errorEl?.classList.remove('hidden');
            };

            const updateWaUI = (state: { qr?: string, initializing?: boolean, authenticated?: boolean, ready?: boolean, waNumber?: string }) => {
                errorEl?.classList.add('hidden');
                if (state.authenticated) {
                    overlay?.classList.remove('hidden');
                    if (status) status.textContent = 'VERIFYING IDENTITY';
                } else if (state.ready && state.waNumber) {
                    checkPhoneMatch(state.waNumber);
                } else if (state.qr) {
                    if (qrImg) qrImg.src = state.qr;
                    loader?.classList.add('hidden');
                    qrImg?.classList.remove('hidden');
                    overlay?.classList.add('hidden');
                    if (status) status.textContent = 'SCAN QR CODE';
                } else if (state.initializing) {
                    loader?.classList.remove('hidden');
                    qrImg?.classList.add('hidden');
                    overlay?.classList.add('hidden');
                    if (status) status.textContent = 'INITIALIZING...';
                }
            };

            const checkPhoneMatch = async (waNumber: string) => {
                try {
                    const user = await (window as any).api.getCurrentUser();
                    if (!user?.phone) {
                        showWaError('No verified phone number found.');
                        overlay?.classList.add('hidden');
                        return;
                    }

                    const normalizedAccount = user.phone.replace(/\D/g, '');
                    const normalizedWa = waNumber.replace(/\D/g, '');

                    if (normalizedAccount.length >= 8 && normalizedWa.length >= 8 &&
                        (normalizedWa.endsWith(normalizedAccount) || normalizedAccount.endsWith(normalizedWa))) {
                        verifiedPhone = user.phone;
                        if (status) status.textContent = 'SENDING PIN...';

                        const encryptedPin = localStorage.getItem(this.cb.getStorageKey('vault_pin'));
                        if (!encryptedPin) {
                            showWaError('No PIN found to recover.');
                            overlay?.classList.add('hidden');
                            return;
                        }

                        let pin: string;
                        try {
                            pin = await (window as any).api.decryptPIN(encryptedPin);
                        } catch (e) {
                            showWaError('Failed to retrieve PIN.');
                            overlay?.classList.add('hidden');
                            return;
                        }

                        const sendResult = await (window as any).api.sendPinResetCode(
                            user.phone,
                            `🔐 Your Keyra Vault PIN is: ${pin}\n\n⚠️ For security, please delete this message after reading.`
                        );

                        if (!sendResult.success) {
                            showWaError(sendResult.message || 'Failed to send PIN.');
                            overlay?.classList.add('hidden');
                            return;
                        }

                        const phoneDisplay = document.getElementById('forgot-pin-code-phone');
                        if (phoneDisplay) phoneDisplay.textContent = this.maskPhoneNumber(user.phone);
                        showView('code');
                        this.cb.showToast('PIN sent to your WhatsApp!', 'success');
                    } else {
                        showWaError('WhatsApp number does not match your verified phone.');
                        overlay?.classList.add('hidden');
                        if (status) status.textContent = 'MISMATCH';
                    }
                } catch (err) {
                    console.error('[UI] Phone match check error:', err);
                    showWaError('Verification failed. Please try again.');
                    overlay?.classList.add('hidden');
                }
            };

            (window as any).api.onWaInitializing(() => updateWaUI({ initializing: true }));
            (window as any).api.onWaQrCode((qr: string) => updateWaUI({ qr }));
            (window as any).api.onWaAuthenticated(() => updateWaUI({ authenticated: true }));
            (window as any).api.onWaReady((waNumber?: string) => updateWaUI({ ready: true, waNumber }));
            (window as any).api.onWaAuthFailure((err: string) => {
                showWaError(`WhatsApp error: ${err}`);
                if (status) status.textContent = 'ERROR';
            });

            (window as any).api.startWhatsAppLinking();
            const currentStatus = await (window as any).api.getWaStatus();
            updateWaUI(currentStatus);
        };

        const doneHandler = () => {
            modal.classList.remove('show');
            setTimeout(() => modal.classList.add('hidden'), 300);
            const pinIn = document.getElementById('unlock-pin') as HTMLInputElement;
            if (pinIn) { pinIn.value = ''; pinIn.focus(); }
        };

        const attachListener = (id: string, handler: (e?: Event) => void, event = 'click') => {
            const el = document.getElementById(id);
            if (el) {
                const newEl = el.cloneNode(true);
                el.parentNode?.replaceChild(newEl, el);
                newEl.addEventListener(event, handler);
            }
        };

        attachListener('confirm-forgot-pin-btn', confirmHandler);
        attachListener('cancel-forgot-pin-btn', cancelHandler);
        attachListener('btn-forgot-pin-whatsapp', startWhatsAppFlow);
        attachListener('btn-pin-sent-done', doneHandler);

        const form1 = document.getElementById('form-forgot-pin');
        if (form1) {
            const newForm = form1.cloneNode(true);
            form1.parentNode?.replaceChild(newForm, form1);
            newForm.addEventListener('submit', confirmHandler);
            setTimeout(() => (document.getElementById('forgot-pin-password') as HTMLInputElement)?.focus(), 150);
        }

        (window as any).api.getCurrentUser().then((user: any) => {
            const hasVerifiedPhone = user?.phone && user?.isPhoneVerified;
            const divider = document.getElementById('forgot-pin-wa-divider');
            const waBtn = document.getElementById('btn-forgot-pin-whatsapp');

            if (hasVerifiedPhone) {
                divider?.classList.remove('hidden');
                waBtn?.classList.remove('hidden');
                if (divider) (divider as HTMLElement).style.display = 'flex';
                const phoneHint = document.getElementById('forgot-pin-wa-phone-hint');
                if (phoneHint) phoneHint.textContent = `Use the WhatsApp account linked to ${this.maskPhoneNumber(user.phone)}`;
            } else {
                divider?.classList.add('hidden');
                waBtn?.classList.add('hidden');
            }
        });
    }
}
