import { AccountRenderer } from './AccountRenderer.js';

export interface AccountCallbacks {
    getPrivacyMode: () => boolean;
    getVaultViewStyle: () => string;
    getUserId: () => string;
    showToast: (msg: string, type: 'info' | 'success' | 'error') => void;
    setLoading: (show: boolean, title?: string, subtitle?: string) => void;
    showModal: (content: string) => void;
    hideModal: () => void;
    showCopyFeedback: (el: HTMLElement) => void;
    applySettings: (settings: any, saveLocal: boolean) => void;
    handleLocalAccountUI: (user: any) => void;
    updateLastActivity: (action: string) => void;
    pushSettings: () => Promise<any>;
    updateSegmentedUI: (id: string, val: string) => void;
    updateAccountView: () => Promise<void>;
    showStaticModal: (id: string) => void;
}

export class AccountManager {
    public accounts: any[] = [];
    public searchQuery: string = '';
    private pendingConflictAction: string | null = null;
    private pendingConflictData: any = null;

    private cb: AccountCallbacks;
    public renderer: AccountRenderer;

    constructor(callbacks: AccountCallbacks) {
        this.cb = callbacks;
        this.renderer = new AccountRenderer({
            getPrivacyMode: () => this.cb.getPrivacyMode(),
            getVaultViewStyle: () => this.cb.getVaultViewStyle(),
            showToast: (msg, type) => this.cb.showToast(msg, type),
            showCopyFeedback: (el) => this.cb.showCopyFeedback(el),
            updateLastActivity: (action) => this.cb.updateLastActivity(action),
            showModal: (content) => this.cb.showModal(content),
            hideModal: () => this.cb.hideModal(),
            showEditModal: (account) => this.showEditModal(account),
            showDeleteConfirm: (account) => this.showDeleteConfirm(account),
            showOtpModal: (account) => this.renderer.showOtpModal(account),
        });
    }

    // ─── Timer ────────────────────────────────────────────────────────────────

    public startTimer() {
        this.renderer.startTimer(() => this.accounts);
    }

    public stopTimer() {
        this.renderer.stopTimer();
    }

    // ─── Load & Refresh ───────────────────────────────────────────────────────

    public async loadInitialData() {
        try {
            const user = await (window as any).api.getCurrentUser();
            if (user) {
                const nameDisplay = document.getElementById('user-name-display');
                if (nameDisplay) nameDisplay.textContent = user.username;

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

                const dropdownName = document.getElementById('dropdown-user-name');
                const dropdownEmail = document.getElementById('dropdown-user-email');
                if (dropdownName) dropdownName.textContent = user.username;
                if (dropdownEmail) dropdownEmail.textContent = user.isLocal ? "Local-Only Account" : (user.email || 'Keyra Secure Vault');

                this.cb.handleLocalAccountUI(user);
            }
            await this.refreshAccounts();
            await this.cb.updateAccountView();
        } catch (err) {
            console.error("Load failed", err);
        }
    }

    public async refreshAccounts() {
        this.renderer.showSkeletonLoaders();
        this.accounts = await (window as any).api.getAccounts();
        await new Promise(resolve => setTimeout(resolve, 300));
        this.renderAccounts();
    }

    public renderAccounts() {
        this.renderer.renderAccounts(this.accounts, this.searchQuery);
    }

    // ─── Scanned Data ─────────────────────────────────────────────────────────

    public async handleScannedData(data: string) {
        try {
            if (!data.startsWith('otpauth://totp/')) {
                this.cb.showToast("QR code not recognized", "error");
                return;
            }
            this.cb.setLoading(true, "Processing QR", "DECODING SECURE URI");
            try {
                const parsed = await (window as any).api.parseURI(data);
                await (window as any).api.generateTOTP(parsed.secret);
                const res = await (window as any).api.saveAccount({
                    id: Date.now().toString(),
                    issuer: parsed.issuer,
                    account: parsed.account,
                    secret: parsed.secret
                });
                if (res.conflict) {
                    this.showSyncConflictModal('save-account', {
                        id: Date.now().toString(),
                        issuer: parsed.issuer,
                        account: parsed.account,
                        secret: parsed.secret
                    });
                    return;
                }
                this.accounts = res.accounts || [];
                this.renderAccounts();
                this.cb.showToast(`Account added!`, "success");
                this.cb.updateLastActivity('Added token via Scan');
            } finally {
                this.cb.setLoading(false);
            }
        } catch (err) {
            console.error("Invalid QR Format", err);
            this.cb.showToast("Invalid QR Format", "error");
        }
    }

    // ─── Sync Conflict ────────────────────────────────────────────────────────

    public showSyncConflictModal(action: string, data: any) {
        this.pendingConflictAction = action;
        this.pendingConflictData = data;

        const modal = document.getElementById('modal-sync-conflict');
        if (!modal) return;

        // Reset state: clone nodes to wipe all previous event listeners
        const forcePushOption = document.getElementById('option-force-push');
        const pullRemoteOption = document.getElementById('option-pull-remote');
        const resolveBtn = document.getElementById('btn-resolve-sync-conflict') as HTMLButtonElement;
        const closeBtn = document.getElementById('btn-close-sync-conflict');

        const freshForce = forcePushOption?.cloneNode(true) as HTMLElement;
        const freshPull  = pullRemoteOption?.cloneNode(true) as HTMLElement;
        const freshClose = closeBtn?.cloneNode(true) as HTMLElement;
        const freshResolve = resolveBtn?.cloneNode(true) as HTMLButtonElement;

        forcePushOption?.replaceWith(freshForce);
        pullRemoteOption?.replaceWith(freshPull);
        closeBtn?.replaceWith(freshClose);
        resolveBtn?.replaceWith(freshResolve);

        // Reset selection UI
        freshForce.classList.remove('selected');
        freshPull.classList.remove('selected');
        freshResolve.classList.add('disabled');
        freshResolve.disabled = true;

        let selectedResolution: 'force' | 'pull' | null = null;

        const updateSelection = (res: 'force' | 'pull') => {
            selectedResolution = res;
            freshForce.classList.toggle('selected', res === 'force');
            freshPull.classList.toggle('selected', res === 'pull');
            freshResolve.classList.remove('disabled');
            freshResolve.disabled = false;
        };

        freshForce.addEventListener('click', () => updateSelection('force'));
        freshPull.addEventListener('click', () => updateSelection('pull'));

        freshClose.addEventListener('click', () => {
            modal.classList.remove('show');
            setTimeout(() => modal.classList.add('hidden'), 300);
            this.pendingConflictAction = null;
            this.pendingConflictData = null;
        });

        freshResolve.addEventListener('click', async () => {
            if (!selectedResolution || freshResolve.disabled) return;
            // Prevent double-click
            freshResolve.disabled = true;
            freshClose.setAttribute('disabled', 'true');

            this.cb.setLoading(true, "Resolving Conflict", "SYNCHRONIZING SECURE DATA");
            try {
                if (selectedResolution === 'force') {
                    let res: any;
                    if (this.pendingConflictAction === 'save-account') {
                        res = await (window as any).api.saveAccount(this.pendingConflictData, true);
                    } else if (this.pendingConflictAction === 'delete-account') {
                        res = await (window as any).api.deleteAccount(this.pendingConflictData, true);
                    } else if (this.pendingConflictAction === 'update-user-settings') {
                        res = await (window as any).api.updateUserSettings(this.pendingConflictData, true);
                    }
                    if (res?.success) {
                        this.cb.showToast("Conflict resolved — local version pushed", "success");
                        if (res.accounts) {
                            this.accounts = res.accounts;
                            this.renderAccounts();
                        }
                        this.closeConflictModal(modal);
                    } else {
                        this.cb.showToast(res?.message || "Resolution failed", "error");
                        freshResolve.disabled = false;
                        freshClose.removeAttribute('disabled');
                    }
                } else {
                    await this.refreshAccounts();
                    const user = await (window as any).api.getCurrentUser();
                    if (user) {
                        this.cb.handleLocalAccountUI(user);
                        const settings = user['Desktop Settings'] || user.settings || {};
                        this.cb.applySettings(settings, true);
                    }
                    this.cb.showToast("Conflict resolved — remote version pulled", "success");
                    this.closeConflictModal(modal);
                }
            } catch (err) {
                console.error("Resolution Error:", err);
                this.cb.showToast("An error occurred during resolution", "error");
                freshResolve.disabled = false;
                freshClose.removeAttribute('disabled');
            } finally {
                this.cb.setLoading(false);
            }
        });

        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('show'), 10);
    }

    private closeConflictModal(modal: HTMLElement) {
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 300);
        this.pendingConflictAction = null;
        this.pendingConflictData = null;
        this.cb.hideModal();
    }

    // ─── Add / Edit / Delete Modals ───────────────────────────────────────────

    public showAddModal() {
        const content = `
            <div class="modal-content">
                <div class="nm-modal-header">
                    <div class="nm-modal-icon accent"><i class="fa-solid fa-circle-plus"></i></div>
                    <div class="nm-modal-titles">
                        <h2 class="nm-modal-title">Add Token</h2>
                        <p class="nm-modal-subtitle">SAVE DIGITAL IDENTITY</p>
                    </div>
                </div>
                <div class="nm-modal-divider"></div>
                <div class="modal-body">
                    <div class="nm-form-stack">
                    <div class="form-group">
                        <label class="form-label">Service</label>
                        <input type="text" id="new-issuer" class="form-input" placeholder="e.g. GitHub, Google">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Account</label>
                        <input type="text" id="new-account" class="form-input" placeholder="name@domain.com" inputmode="email">
                    </div>
                    <div class="form-group">
                        <label class="form-label">TOTP Secret</label>
                        <input type="text" id="new-secret" class="form-input" placeholder="Enter secret key" autocomplete="off">
                    </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" id="save-new-account">
                        <i class="fa-solid fa-shield-halved"></i>
                        Save Token
                    </button>
                    <button class="user-button" id="btn-scan-screen-trigger" style="justify-content: center; white-space: nowrap;">
                        <i class="fa-solid fa-desktop"></i>
                        Scan
                    </button>
                    <button class="user-button" id="cancel-add-btn" style="justify-content: center;">Cancel</button>
                </div>
            </div>
        `;
        this.cb.showModal(content);

        document.getElementById('btn-scan-screen-trigger')?.addEventListener('click', () => {
            this.cb.hideModal();
            (window as any).api.openCaptureWindow();
        });

        const saveAccountAction = async () => {
            const issuer = (document.getElementById('new-issuer') as HTMLInputElement).value.trim();
            const account = (document.getElementById('new-account') as HTMLInputElement).value.trim();
            const secret = (document.getElementById('new-secret') as HTMLInputElement).value.replace(/\s/g, '').toUpperCase();
            if (issuer && secret) {
                this.cb.setLoading(true, "Securing Token", "ENCRYPTING NEW IDENTITY");
                try {
                    const res = await (window as any).api.saveAccount({ id: Date.now().toString(), issuer, account, secret });
                    if (res.conflict) {
                        this.showSyncConflictModal('save-account', { id: Date.now().toString(), issuer, account, secret });
                        return;
                    }
                    this.accounts = res.accounts || [];
                    this.renderAccounts();
                    this.cb.hideModal();
                    this.cb.showToast("Account saved!", "success");
                    this.cb.updateLastActivity('Added token');
                } finally {
                    this.cb.setLoading(false);
                }
            } else {
                this.cb.showToast("Service and Secret are required", "error");
            }
        };

        document.getElementById('save-new-account')?.addEventListener('click', saveAccountAction);
        ['new-issuer', 'new-account', 'new-secret'].forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveAccountAction();
            });
        });
        document.getElementById('cancel-add-btn')?.addEventListener('click', () => this.cb.hideModal());
    }

    public showEditModal(account: any) {
        const content = `
            <div class="modal-content">
                <div class="nm-modal-header">
                    <div class="nm-modal-icon accent"><i class="fa-solid fa-sliders"></i></div>
                    <div class="nm-modal-titles">
                        <h2 class="nm-modal-title">Edit Identity</h2>
                        <p class="nm-modal-subtitle">UPDATE SERVICE DETAILS</p>
                    </div>
                </div>
                <div class="nm-modal-divider"></div>
                <div class="modal-body">
                    <div class="nm-entity-card">
                        <div class="nm-entity-icon"><i class="fa-solid fa-shield"></i></div>
                        <div class="nm-entity-info">
                            <span class="nm-entity-name">${account.issuer}</span>
                            <span class="nm-entity-meta">${account.account || 'Vault Token'}</span>
                        </div>
                    </div>
                    <div class="nm-form-stack">
                    <div class="form-group">
                        <label class="form-label">Service</label>
                        <input type="text" id="edit-issuer" class="form-input" value="${account.issuer}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Account</label>
                        <input type="text" id="edit-account" class="form-input" value="${account.account}" inputmode="email">
                    </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" id="update-account">
                        <i class="fa-solid fa-check"></i>
                        Save Changes
                    </button>
                    <button class="user-button" id="cancel-edit-btn" style="justify-content: center;">Cancel</button>
                </div>
            </div>
        `;
        this.cb.showModal(content);
        const updateAccountAction = async () => {
            const issuer = (document.getElementById('edit-issuer') as HTMLInputElement).value.trim();
            const accName = (document.getElementById('edit-account') as HTMLInputElement).value.trim();
            if (issuer) {
                this.cb.setLoading(true, "Updating Identity", "SYNCHRONIZING CHANGES");
                try {
                    const res = await (window as any).api.saveAccount({ ...account, issuer, account: accName });
                    if (res.conflict) {
                        this.showSyncConflictModal('save-account', { ...account, issuer, account: accName });
                        return;
                    }
                    this.accounts = res.accounts || [];
                    this.renderAccounts();
                    this.cb.hideModal();
                    this.cb.showToast("Account updated!", "success");
                    this.cb.updateLastActivity('Edited token');
                } finally {
                    this.cb.setLoading(false);
                }
            }
        };
        document.getElementById('update-account')?.addEventListener('click', updateAccountAction);
        ['edit-issuer', 'edit-account'].forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') updateAccountAction();
            });
        });
        document.getElementById('cancel-edit-btn')?.addEventListener('click', () => this.cb.hideModal());
    }

    public showDeleteConfirm(account: any) {
        const content = `
            <div class="modal-content">
                <div class="nm-modal-header">
                    <div class="nm-modal-icon danger"><i class="fa-solid fa-trash-can"></i></div>
                    <div class="nm-modal-titles">
                        <h2 class="nm-modal-title danger">Delete Token?</h2>
                        <p class="nm-modal-subtitle">PERMANENT ACTION</p>
                    </div>
                </div>
                <div class="nm-modal-divider"></div>
                <div class="modal-body">
                    <div class="nm-entity-card">
                        <div class="nm-entity-icon"><i class="fa-solid fa-shield"></i></div>
                        <div class="nm-entity-info">
                            <span class="nm-entity-name">${account.issuer}</span>
                            <span class="nm-entity-meta">${account.account || 'Vault Token'}</span>
                        </div>
                    </div>
                    <p class="nm-modal-help">Removing this token is permanent. You will lose access to its OTP codes.</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-danger" id="confirm-delete">
                        <i class="fa-solid fa-trash-can"></i>
                        Delete Token
                    </button>
                    <button class="user-button" id="cancel-delete-btn" style="justify-content: center;">Keep Token</button>
                </div>
            </div>
        `;
        this.cb.showModal(content);
        document.getElementById('confirm-delete')?.addEventListener('click', async () => {
            this.cb.setLoading(true, "Removing Token", "PERMANENT DELETION IN PROGRESS");
            try {
                const res = await (window as any).api.deleteAccount(account.id);
                if (res.conflict) {
                    this.showSyncConflictModal('delete-account', account.id);
                    return;
                }
                this.accounts = res.accounts || [];
                this.renderAccounts();
                this.cb.hideModal();
                this.cb.showToast("Account removed", "info");
                this.cb.updateLastActivity('Deleted token');
            } finally {
                this.cb.setLoading(false);
            }
        });
        document.getElementById('cancel-delete-btn')?.addEventListener('click', () => this.cb.hideModal());
    }

    // ─── Export / Import Modals ───────────────────────────────────────────────

    public showExportOptionsModal() {
        const content = `
            <div class="modal-content">
                <div class="nm-modal-header">
                    <div class="nm-modal-icon accent"><i class="fa-solid fa-download"></i></div>
                    <div class="nm-modal-titles">
                        <h2 class="nm-modal-title">Export Vault</h2>
                        <p class="nm-modal-subtitle">CHOOSE YOUR EXPORT FORMAT</p>
                    </div>
                </div>
                <div class="nm-modal-divider"></div>
                <div class="modal-body">
                    <div class="nm-export-options">
                        <button class="nm-export-card" data-format="encrypted">
                            <div class="nm-export-icon"><i class="fa-solid fa-lock"></i></div>
                            <div class="nm-export-body">
                                <div class="nm-export-title">Full Encrypted Backup</div>
                                <div class="nm-export-desc">Complete vault with settings (.keyra)</div>
                            </div>
                            <div class="nm-export-check"><i class="fa-solid fa-check"></i></div>
                        </button>
                        <button class="nm-export-card" data-format="qr-pdf">
                            <div class="nm-export-icon accent"><i class="fa-solid fa-qrcode"></i></div>
                            <div class="nm-export-body">
                                <div class="nm-export-title">QR Codes (PDF)</div>
                                <div class="nm-export-desc">Printable QR codes for each account</div>
                            </div>
                            <div class="nm-export-check"><i class="fa-solid fa-check"></i></div>
                        </button>
                        <button class="nm-export-card" data-format="json">
                            <div class="nm-export-icon warning"><i class="fa-solid fa-file-code"></i></div>
                            <div class="nm-export-body">
                                <div class="nm-export-title">Plain JSON</div>
                                <div class="nm-export-desc">Unencrypted JSON for migration (.json)</div>
                            </div>
                            <div class="nm-export-check"><i class="fa-solid fa-check"></i></div>
                        </button>
                        <button class="nm-export-card" data-format="text">
                            <div class="nm-export-icon muted"><i class="fa-solid fa-file-lines"></i></div>
                            <div class="nm-export-body">
                                <div class="nm-export-title">Text File</div>
                                <div class="nm-export-desc">Human-readable text format (.txt)</div>
                            </div>
                            <div class="nm-export-check"><i class="fa-solid fa-check"></i></div>
                        </button>
                    </div>
                    <div id="export-selection-container" class="nm-export-selection hidden">
                        <div class="nm-export-sel-row">
                            <div class="nm-export-sel-info">
                                <div class="nm-export-sel-title">Export Selection</div>
                                <div class="nm-export-sel-desc">Choose specific accounts or export all</div>
                            </div>
                            <label class="switch" style="flex-shrink: 0;">
                                <input type="checkbox" id="export-selective" checked>
                                <span class="slider round"></span>
                            </label>
                        </div>
                        <div id="export-accounts-list" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--bg-secondary);"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" id="confirm-export" style="flex: 2;">
                        <i class="fa-solid fa-download"></i>
                        <span>Export Vault</span>
                    </button>
                    <button class="user-button" id="cancel-export" style="justify-content: center;">Cancel</button>
                </div>
            </div>
        `;
        this.cb.showModal(content);

        let selectedFormat = 'encrypted';
        const selectionContainer = document.getElementById('export-selection-container');

        document.querySelectorAll('.nm-export-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.nm-export-card').forEach(c => {
                    c.classList.remove('selected');
                    (c as HTMLElement).classList.remove('selected');
                    const check = c.querySelector('.export-check') as HTMLElement;
                    if (check) check.style.opacity = '0';
                c.classList.remove('selected');
                });
                (card as HTMLElement).classList.add('selected');
                selectedFormat = card.getAttribute('data-format') || 'encrypted';
                if (selectionContainer) {
                    selectionContainer.classList.toggle('hidden', selectedFormat === 'encrypted');
                }
            });
        });

        const firstCard = document.querySelector('.nm-export-card') as HTMLElement;
        if (firstCard) firstCard.click();

        const selectiveToggle = document.getElementById('export-selective') as HTMLInputElement;
        const accountsList = document.getElementById('export-accounts-list');
        selectiveToggle?.addEventListener('change', () => {
            if (accountsList) {
                if (selectiveToggle.checked) {
                    accountsList.style.display = 'none';
                } else {
                    accountsList.style.display = 'block';
                    accountsList.innerHTML = this.accounts.map(acc => `
                        <label style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--bg-secondary); border-radius: 10px; margin-bottom: 6px; cursor: pointer; transition: all 0.2s ease;">
                            <input type="checkbox" class="export-account-check" data-id="${acc.id}" checked style="width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent-primary);">
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">${acc.issuer}</div>
                                <div style="font-size: 10px; color: var(--text-secondary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${acc.account}</div>
                            </div>
                        </label>
                    `).join('');
                }
            }
        });

        document.getElementById('confirm-export')?.addEventListener('click', async () => {
            const exportAll = selectiveToggle?.checked !== false;
            let accountsToExport = this.accounts;
            if (!exportAll) {
                const selectedIds = Array.from(document.querySelectorAll('.export-account-check:checked'))
                    .map(cb => (cb as HTMLInputElement).getAttribute('data-id'));
                accountsToExport = this.accounts.filter(acc => selectedIds.includes(acc.id));
                if (accountsToExport.length === 0) {
                    this.cb.showToast("Please select at least one account", "error");
                    return;
                }
            }
            this.cb.hideModal();
            await this.performExport(selectedFormat, accountsToExport);
        });

        document.getElementById('cancel-export')?.addEventListener('click', () => this.cb.hideModal());
    }

    public async performExport(format: string, accounts: any[]) {
        this.cb.setLoading(true, "Exporting Vault", "PREPARING SECURE EXPORT");
        try {
            switch (format) {
                case 'encrypted': await this.exportEncrypted(); break;
                case 'qr-pdf': await this.exportQRCodesPDF(accounts); break;
                case 'json': await this.exportJSON(accounts); break;
                case 'text': await this.exportText(accounts); break;
            }
            this.cb.showToast("Export completed successfully!", "success");
            this.cb.updateLastActivity('Exported vault');
        } catch (error) {
            console.error("Export failed:", error);
            this.cb.showToast("Export failed. Please try again.", "error");
        } finally {
            this.cb.setLoading(false);
        }
    }

    private async exportEncrypted() {
        const res = await (window as any).api.exportVault();
        if (!res.success && res.message) throw new Error(res.message);
    }

    private async exportQRCodesPDF(accounts: any[]) {
        const res = await (window as any).api.exportQRHTML(accounts);
        if (!res.success && res.message) throw new Error(res.message);
        if (res.success) this.cb.showToast("Open the HTML file and print to PDF", "info");
    }

    private async exportJSON(accounts: any[]) {
        const res = await (window as any).api.exportJSON(accounts);
        if (!res.success && res.message) throw new Error(res.message);
    }

    private async exportText(accounts: any[]) {
        const res = await (window as any).api.exportText(accounts);
        if (!res.success && res.message) throw new Error(res.message);
    }
}
