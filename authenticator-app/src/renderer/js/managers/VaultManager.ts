export interface VaultCallbacks {
    getStorageKey: (key: string) => string;
    pushSettings: () => void;
    showToast: (msg: string, type: 'info' | 'success' | 'error') => void;
    setLoading: (show: boolean, title?: string, subtitle?: string) => void;
    showModal: (content: string) => void;
    hideModal: () => void;
    refreshAccounts: () => Promise<void>;
    renderAccounts: () => void;
    updateSegmentedUI: (id: string, val: string) => void;
    updateLastActivity: (action: string) => void;
    showExportOptionsModal: () => void;
    performExport: (format: string, accountsList: any[]) => Promise<void>;
    setSearchQuery: (query: string) => void;
}

export class VaultManager {
    public vaultViewStyle: 'unified' | 'compact' | 'secure' = 'compact';
    public searchQuery: string = '';

    constructor(private cb: VaultCallbacks) {}

    initVaultViewStyle() {
        const saved = localStorage.getItem(this.cb.getStorageKey('vault_view_style')) as any;
        if (saved && ['unified', 'compact', 'secure'].includes(saved)) {
            this.vaultViewStyle = saved;
        } else {
            const legacy = localStorage.getItem(this.cb.getStorageKey('vaultViewStyle')) as any;
            if (legacy && ['unified', 'compact', 'secure'].includes(legacy)) {
                this.vaultViewStyle = legacy;
                localStorage.setItem(this.cb.getStorageKey('vault_view_style'), legacy);
                localStorage.removeItem(this.cb.getStorageKey('vaultViewStyle'));
            }
        }
        const globalVessel = document.getElementById('global-timer-vessel');
        if (globalVessel) globalVessel.classList.toggle('hidden', this.vaultViewStyle !== 'unified');
    }

    applyVaultViewStyle(value: 'unified' | 'compact' | 'secure') {
        this.vaultViewStyle = value;
        this.cb.updateSegmentedUI('countdown-style-segmented', this.vaultViewStyle);
        const globalVessel = document.getElementById('global-timer-vessel');
        if (globalVessel) globalVessel.classList.toggle('hidden', this.vaultViewStyle !== 'unified');
        this.cb.renderAccounts();
    }

    setupEventListeners() {
        // Vault View Style toggle
        const countdownSegmented = document.getElementById('countdown-style-segmented');
        countdownSegmented?.querySelectorAll('.segment').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.getAttribute('data-val') as any;
                this.vaultViewStyle = val || 'unified';
                localStorage.setItem(this.cb.getStorageKey('vault_view_style'), this.vaultViewStyle);
                this.cb.updateSegmentedUI('countdown-style-segmented', this.vaultViewStyle);
                const globalVessel = document.getElementById('global-timer-vessel');
                if (globalVessel) globalVessel.classList.toggle('hidden', this.vaultViewStyle !== 'unified');
                this.cb.renderAccounts();
                this.cb.pushSettings();
                this.cb.showToast(`View style: ${this.vaultViewStyle.charAt(0).toUpperCase() + this.vaultViewStyle.slice(1)}`, "info");
                this.cb.updateLastActivity(`Changed view to ${this.vaultViewStyle}`);
            });
        });

        // Export
        document.getElementById('btn-export-vault')?.addEventListener('click', () => {
            this.cb.showExportOptionsModal();
        });

        // Import
        document.getElementById('btn-import-vault')?.addEventListener('click', async () => {
            this.cb.setLoading(true, "Opening Explorer", "SELECTING BACKUP FILE");
            try {
                const res = await (window as any).api.importVault();
                if (res.success && res.data) {
                    await this.showImportPasswordModal(res.data);
                }
            } finally {
                this.cb.setLoading(false);
            }
        });

        // Search — debounced to avoid re-rendering on every keystroke
        const searchInput = document.getElementById('vault-search') as HTMLInputElement;
        let searchDebounce: any = null;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase().trim();
                this.cb.setSearchQuery(this.searchQuery);
                this.cb.renderAccounts();
            }, 200);
        });
    }

    async showImportPasswordModal(data: any) {
        const verification = await (window as any).api.verifyBackupFile(data);

        const {
            salt,
            encryptedVaultData,
            encryptedSettings,
            autolock,
            "Desktop Settings": desktopSettings,
            "Web Settings": webSettings
        } = data;

        let dateStr = "Unknown";
        if (verification.timestamp) {
            const date = new Date(verification.timestamp);
            dateStr = date.toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }

        const encryptionBadge = verification.encrypted
            ? '<div class="badge" style="background: var(--success); color: white; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800;"><i class="fa-solid fa-lock"></i> FULLY ENCRYPTED</div>'
            : '<div class="badge" style="background: #ff9500; color: white; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 800;"><i class="fa-solid fa-triangle-exclamation"></i> LEGACY FORMAT</div>';

        let checksumStatus = '';
        if (verification.hasChecksum) {
            checksumStatus = verification.checksumValid
                ? '<div style="display: flex; align-items: center; gap: 8px; color: var(--success); font-size: 13px; font-weight: 700; margin-top: 12px;"><i class="fa-solid fa-circle-check"></i><span>Integrity Verified</span></div>'
                : '<div style="display: flex; align-items: center; gap: 8px; color: #ff3b30; font-size: 13px; font-weight: 700; margin-top: 12px;"><i class="fa-solid fa-triangle-exclamation"></i><span>Checksum Mismatch - File may be corrupted</span></div>';
        }

        const warningSection = !verification.valid
            ? `<div style="background: rgba(255, 59, 48, 0.1); border: 2px solid #ff3b30; border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-md);">
                <div style="display: flex; align-items: center; gap: 12px; color: #ff3b30;">
                    <i class="fa-solid fa-circle-exclamation" style="font-size: 24px;"></i>
                    <div>
                        <div style="font-weight: 800; font-size: 14px; margin-bottom: 4px;">Invalid Backup File</div>
                        <div style="font-size: 12px; opacity: 0.9;">${verification.error || 'This file cannot be restored'}</div>
                    </div>
                </div>
            </div>` : '';

        const infoRow = (icon: string, label: string, value: string) => `
            <div style="display: flex; align-items: center; padding: 12px 16px; background: var(--bg-secondary); border-radius: 12px;">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--bg-primary); box-shadow: var(--nm-shadow-in-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 14px;">
                    <i class="${icon}" style="font-size: 16px; color: var(--accent-primary);"></i>
                </div>
                <div>
                    <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">${label}</div>
                    <div style="font-size: 15px; font-weight: 800; color: var(--text-primary);">${value}</div>
                </div>
            </div>`;

        const content = `
            <div class="modal-content" style="max-width: 600px; padding: clamp(24px, 5vw, 40px);">
                <div style="display: flex; align-items: flex-start; gap: 20px; margin-bottom: 28px;">
                    <div class="modal-icon-vessel" style="width: 72px; height: 72px; flex-shrink: 0;">
                        <i class="fa-solid fa-upload" style="font-size: 32px;"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <h2 style="font-weight: 900; font-size: clamp(22px, 4vw, 28px); color: var(--text-primary); margin: 0 0 12px 0; line-height: 1.2;">Restore Vault</h2>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.8px; color: var(--text-secondary); text-transform: uppercase;">Verify Master Key</div>
                            ${encryptionBadge}
                        </div>
                    </div>
                </div>
                ${warningSection}
                <div style="background: var(--bg-primary); border-radius: 16px; padding: 20px; box-shadow: var(--nm-shadow-in-sm); margin-bottom: 24px;">
                    <div style="font-size: 10px; font-weight: 800; letter-spacing: 1px; color: var(--text-secondary); margin-bottom: 16px; text-transform: uppercase; opacity: 0.7;">Backup Information</div>
                    <div style="display: grid; gap: 16px;">
                        ${infoRow('fa-solid fa-code-branch', 'Version', verification.version || 'Unknown')}
                        ${infoRow('fa-solid fa-clock', 'Created', dateStr)}
                        ${infoRow('fa-solid fa-key', 'Accounts', verification.accountCount !== undefined ? String(verification.accountCount) : 'Unknown')}
                        <div style="display: flex; align-items: center; padding: 12px 16px; background: var(--bg-secondary); border-radius: 12px;">
                            <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--bg-primary); box-shadow: var(--nm-shadow-in-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 14px;">
                                <i class="fa-solid fa-${verification.encrypted ? 'shield-halved' : 'shield'}" style="font-size: 16px; color: ${verification.encrypted ? 'var(--success)' : '#ff9500'};"></i>
                            </div>
                            <div>
                                <div style="font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Encryption</div>
                                <div style="font-size: 14px; font-weight: 800; color: var(--text-primary);">${verification.encrypted ? 'AES-256-GCM' : 'Partial (Legacy)'}</div>
                            </div>
                        </div>
                    </div>
                    ${checksumStatus}
                </div>
                <div style="margin-bottom: 24px;">
                    <label style="display: block; font-size: 13px; font-weight: 800; color: var(--text-primary); margin-bottom: 10px; letter-spacing: 0.3px;">Backup Master Password</label>
                    <input type="password" id="import-pass" class="form-input" placeholder="Enter your master password" autocomplete="current-password" ${!verification.valid ? 'disabled' : ''} style="width: 100%; height: 52px; font-size: 15px;">
                    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; font-weight: 600; line-height: 1.5;">Enter the master password used when this backup was created.</p>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button class="btn-primary" id="confirm-import" style="flex: 2; height: 56px; font-size: 15px; font-weight: 800; border-radius: 14px;" ${!verification.valid ? 'disabled' : ''}>
                        <i class="fa-solid fa-shield-halved"></i>
                        <span>Restore Vault</span>
                    </button>
                    <button class="user-button" id="cancel-import" style="flex: 1; justify-content: center; height: 56px; font-weight: 800; border-radius: 14px;">Cancel</button>
                </div>
            </div>`;

        this.cb.showModal(content);

        if (verification.valid) {
            document.getElementById('confirm-import')?.addEventListener('click', async () => {
                const pass = (document.getElementById('import-pass') as HTMLInputElement).value;
                if (verification.hasChecksum && !verification.checksumValid) {
                    const confirmed = confirm("Warning: Backup file integrity check failed. The file may be corrupted or tampered with. Continue anyway?");
                    if (!confirmed) return;
                }
                this.cb.setLoading(true, "Restoring Vault", "DECRYPTING BACKUP ARCHIVE");
                try {
                    const res = await (window as any).api.performVaultImport(
                        salt, encryptedVaultData, pass, encryptedSettings,
                        autolock, desktopSettings, webSettings
                    );
                    if (res.success) {
                        this.cb.hideModal();
                        this.cb.showToast("Vault restored!", "success");
                        await this.cb.refreshAccounts();
                    } else {
                        this.cb.showToast(res.message, "error");
                    }
                } finally {
                    this.cb.setLoading(false);
                }
            });
            document.getElementById('import-pass')?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') document.getElementById('confirm-import')?.click();
            });
        }

        document.getElementById('cancel-import')?.addEventListener('click', () => this.cb.hideModal());
    }
}
