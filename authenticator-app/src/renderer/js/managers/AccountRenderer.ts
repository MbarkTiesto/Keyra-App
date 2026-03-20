export interface RendererCallbacks {
    getPrivacyMode: () => boolean;
    getVaultViewStyle: () => string;
    showToast: (msg: string, type: 'info' | 'success' | 'error') => void;
    showCopyFeedback: (el: HTMLElement) => void;
    updateLastActivity: (action: string) => void;
    showModal: (content: string) => void;
    hideModal: () => void;
    showEditModal: (account: any) => void;
    showDeleteConfirm: (account: any) => void;
    showOtpModal: (account: any) => void;
}

export class AccountRenderer {
    public cardCache: HTMLElement[] = [];
    public activeOtpAccount: any = null;
    private timerInterval: any = null;

    private cb: RendererCallbacks;

    constructor(callbacks: RendererCallbacks) {
        this.cb = callbacks;
    }

    // ─── Timer ────────────────────────────────────────────────────────────────

    public startTimer(getAccounts: () => any[]) {
        if (this.timerInterval) clearInterval(this.timerInterval);

        // Use requestAnimationFrame-based loop instead of setInterval for smoother updates
        let lastSecond = -1;
        const tick = async () => {
            const now = Math.floor(Date.now() / 1000);
            if (now !== lastSecond) {
                lastSecond = now;
                const accounts = getAccounts();
                if (accounts.length > 0 && this.cardCache.length > 0) {
                    const secrets = accounts.map((acc: any) => acc.secret);
                    const { otps, remaining } = await (window as any).api.getBatchOTPs(secrets);
                    // Batch all DOM writes in one rAF to avoid layout thrashing
                    requestAnimationFrame(() => {
                        this.cardCache.forEach((card, i) => {
                            if (otps[i]) this.updateCardOTP(card, otps[i], remaining);
                        });
                        if (this.activeOtpAccount) {
                            const activeIndex = accounts.findIndex((a: any) => a.id === this.activeOtpAccount.id);
                            if (activeIndex !== -1 && otps[activeIndex]) {
                                this.updateOtpModal(otps[activeIndex], remaining);
                            }
                        }
                    });
                }
            }
            this.timerInterval = requestAnimationFrame(tick);
        };
        this.timerInterval = requestAnimationFrame(tick);
    }

    public stopTimer() {
        if (this.timerInterval) {
            cancelAnimationFrame(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // ─── Skeleton ─────────────────────────────────────────────────────────────

    public showSkeletonLoaders(count: number = 6) {
        const grid = document.getElementById('accounts-grid');
        const emptyState = document.getElementById('empty-state');
        const searchEmptyState = document.getElementById('search-empty-state');
        if (!grid) return;
        emptyState?.classList.add('hidden');
        searchEmptyState?.classList.add('hidden');
        grid.classList.remove('hidden');
        grid.innerHTML = '';
        for (let i = 0; i < count; i++) {
            grid.appendChild(this.createSkeletonCard(i));
        }
    }

    private createSkeletonCard(index: number): HTMLElement {
        const card = document.createElement('div');
        card.className = 'skeleton-card';
        card.style.animationDelay = `${index * 0.06}s`;
        card.innerHTML = `
            <div class="skeleton-header">
                <div class="skeleton-icon skeleton-shimmer"></div>
                <div class="skeleton-text-group">
                    <div class="skeleton-text title skeleton-shimmer"></div>
                    <div class="skeleton-text subtitle skeleton-shimmer"></div>
                </div>
            </div>
            <div class="skeleton-otp skeleton-shimmer"></div>
            <div class="skeleton-button skeleton-shimmer"></div>
        `;
        return card;
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    public renderAccounts(accounts: any[], searchQuery: string) {
        const grid = document.getElementById('accounts-grid');
        const emptyState = document.getElementById('empty-state');
        const searchEmptyState = document.getElementById('search-empty-state');
        if (!grid || !emptyState || !searchEmptyState) return;

        const filtered = accounts.filter(acc =>
            acc.issuer.toLowerCase().includes(searchQuery) ||
            acc.account.toLowerCase().includes(searchQuery)
        );

        if (accounts.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            searchEmptyState.classList.add('hidden');
            return;
        }

        if (filtered.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.add('hidden');
            searchEmptyState.classList.remove('hidden');
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');
        searchEmptyState.classList.add('hidden');

        // Diff-based update: only skip rebuild if account IDs AND view style are unchanged
        const currentIds = this.cardCache.map(c => c.dataset.id);
        const newIds = filtered.map(acc => acc.id);
        const currentStyle = grid.dataset.viewStyle || '';
        const newStyle = this.cb.getVaultViewStyle();
        const isSameSet = currentIds.length === newIds.length
            && newIds.every((id, i) => id === currentIds[i])
            && currentStyle === newStyle;

        if (!isSameSet) {
            // Use DocumentFragment to batch DOM insertions
            const fragment = document.createDocumentFragment();
            this.cardCache = [];
            filtered.forEach((acc, index) => {
                const card = this.createAccountCard(acc, index);
                card.dataset.id = acc.id;
                fragment.appendChild(card);
                this.cardCache.push(card);
            });
            grid.innerHTML = '';
            grid.dataset.viewStyle = newStyle;
            grid.appendChild(fragment);

            const secrets = filtered.map(acc => acc.secret);
            (window as any).api.getBatchOTPs(secrets).then((res: { otps: string[], remaining: number }) => {
                requestAnimationFrame(() => {
                    this.cardCache.forEach((card, i) => {
                        if (res.otps[i]) this.updateCardOTP(card, res.otps[i], res.remaining);
                    });
                });
            });
        }
    }

    // ─── Card Creation ────────────────────────────────────────────────────────

    public createAccountCard(account: any, index: number): HTMLElement {
        const privacyMode = this.cb.getPrivacyMode();
        const vaultViewStyle = this.cb.getVaultViewStyle();

        const card = document.createElement('div');
        card.className = 'account-card';
        // Cap stagger at 150ms max so large vaults don't feel sluggish
        card.style.animationDelay = `${Math.min(index * 0.04, 0.15)}s`;

        card.innerHTML = `
            <div class="account-header">
                <div class="account-icon">
                    <i class="${this.getIcon(account.issuer)}"></i>
                </div>
                <div class="account-info">
                    <div class="service-name">${account.issuer}</div>
                    <div class="account-identity">${account.account}</div>
                </div>
                <div class="card-actions">
                <button class="btn-card-more">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
                <div class="card-dropdown">
                    <div class="card-dropdown-item edit-btn">
                        <i class="fa-solid fa-pen-to-square icon-left"></i>
                        <span>Edit</span>
                    </div>
                    <div class="card-dropdown-item danger delete-btn">
                        <i class="fa-solid fa-trash-can icon-left"></i>
                        <span>Delete</span>
                    </div>
                </div>
            </div>
            </div>
            <div class="otp-hero">
                ${vaultViewStyle !== 'secure' ? `
                    <div class="otp-code ${privacyMode ? 'privacy-hidden' : ''}">
                        ${privacyMode ? '••••••' : '------'}
                    </div>
                ` : `
                    <button class="btn-primary secure-view-btn" style="width: 100%; height: 50px; background: var(--nm-surface); box-shadow: var(--nm-shadow-out-sm);">
                        <i class="fa-solid fa-shield-halved"></i>
                        <span>Secure View</span>
                    </button>
                `}
                ${vaultViewStyle === 'compact' ? `
                <div class="timer-linear-vessel">
                    <div class="timer-linear-progress"></div>
                </div>` : ''}
            </div>
            ${vaultViewStyle !== 'secure' ? `
            <div class="card-footer" style="padding: 0;">
                <button class="btn-primary copy-btn" style="width: 100%;">
                    <i class="fa-solid fa-copy icon-left"></i>
                    <span>Copy Code</span>
                </button>
            </div>
            ` : ''}
        `;

        const copyBtn = card.querySelector('.copy-btn') as HTMLElement;
        if (copyBtn) {
            copyBtn.onclick = async () => {
                const otpCode = await (window as any).api.generateTOTP(account.secret);
                await navigator.clipboard.writeText(otpCode);
                this.cb.showToast("Code copied!", "success");
                this.cb.updateLastActivity('OTP copied');
            };
        }

        const codeEl = card.querySelector('.otp-code') as HTMLElement;
        if (codeEl) {
            codeEl.onclick = async () => {
                const otpCode = await (window as any).api.generateTOTP(account.secret);
                await navigator.clipboard.writeText(otpCode);
                this.cb.showToast("OTP Copied", "success");
                this.cb.showCopyFeedback(codeEl);
                this.cb.updateLastActivity('OTP copied');
            };
        }

        const moreBtn = card.querySelector('.btn-card-more') as HTMLElement;
        const dropdown = card.querySelector('.card-dropdown') as HTMLElement;

        moreBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.card-dropdown.show').forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove('show');
                    d.previousElementSibling?.classList.remove('active');
                }
            });
            dropdown.classList.toggle('show');
            moreBtn.classList.toggle('active');
        });

        card.querySelector('.edit-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            moreBtn.classList.remove('active');
            this.cb.showEditModal(account);
        });

        card.querySelector('.delete-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.remove('show');
            moreBtn.classList.remove('active');
            this.cb.showDeleteConfirm(account);
        });

        card.querySelector('.secure-view-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cb.showOtpModal(account);
        });

        return card;
    }

    // ─── OTP Updates ──────────────────────────────────────────────────────────

    public updateCardOTP(card: HTMLElement, otp: string, remaining: number) {
        const codeElement = card.querySelector('.otp-code') as HTMLElement;
        if (!codeElement) return;

        const formattedOtp = otp.substring(0, 3) + ' ' + otp.substring(3);
        if (!this.cb.getPrivacyMode()) {
            if (codeElement.textContent !== formattedOtp) {
                codeElement.textContent = formattedOtp;
            }
        }

        const vaultViewStyle = this.cb.getVaultViewStyle();
        if (vaultViewStyle === 'unified') {
            const globalProgressBar = document.getElementById('global-otp-timer') as HTMLElement;
            if (globalProgressBar) {
                const scale = remaining / 30;
                globalProgressBar.style.transform = `scaleX(${scale})`;
                globalProgressBar.style.backgroundColor = remaining <= 5 ? '#ff3b30' : 'var(--accent-primary)';
            }
        } else if (vaultViewStyle === 'compact') {
            const progressBar = card.querySelector('.timer-linear-progress') as HTMLElement;
            if (progressBar) {
                const scale = remaining / 30;
                progressBar.style.transform = `scaleX(${scale})`;
                progressBar.style.backgroundColor = remaining <= 5 ? '#ff3b30' : 'var(--accent-primary)';
            }
        }
    }

    public updateOtpModal(otp: string, remaining: number) {
        const modal = document.querySelector('.otp-modal-container');
        if (!modal || !this.activeOtpAccount) return;

        const codeDisp = modal.querySelector('.otp-modal-code-vessel') as HTMLElement;
        const formattedOtp = otp.substring(0, 3) + ' ' + otp.substring(3);
        if (codeDisp && codeDisp.textContent !== formattedOtp) {
            codeDisp.textContent = formattedOtp;
        }

        const circle = modal.querySelector('.timer-circle-progress') as SVGCircleElement;
        const text = modal.querySelector('.timer-countdown-text') as HTMLElement;
        if (circle && text) {
            const radius = 54;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (remaining / 30) * circumference;
            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            circle.style.strokeDashoffset = offset.toString();
            circle.style.stroke = remaining <= 5 ? '#ff3b30' : 'var(--accent-primary)';
            text.textContent = remaining.toString();
            text.style.color = remaining <= 5 ? '#ff3b30' : 'var(--accent-primary)';
        }
    }

    public async showOtpModal(account: any) {
        this.activeOtpAccount = account;
        const initialOtp = await (window as any).api.generateTOTP(account.secret);
        const { remaining } = await (window as any).api.getBatchOTPs([account.secret]);
        const iconClass = this.getIcon(account.issuer);

        const content = `
            <div class="otp-modal-container">
                <div class="otp-modal-header">
                    <div class="otp-modal-icon-vessel">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="otp-modal-name">${account.issuer}</div>
                    <div class="otp-modal-account">${account.account}</div>
                </div>
                <div class="circular-timer-vessel">
                    <svg class="circular-timer-svg" width="120" height="120">
                        <circle class="timer-circle-bg" cx="60" cy="60" r="54"></circle>
                        <circle class="timer-circle-progress" cx="60" cy="60" r="54"></circle>
                    </svg>
                    <div class="timer-countdown-text">${remaining}</div>
                </div>
                <div class="otp-modal-code-vessel" id="otp-modal-copy">
                    ${initialOtp.substring(0, 3)} ${initialOtp.substring(3)}
                </div>
                <p class="otp-modal-hint">Tap code to copy</p>
                <div class="otp-modal-footer">
                    <button class="btn-primary" id="btn-otp-modal-copy" style="flex: 1;">
                        <i class="fa-solid fa-copy"></i>
                        Copy
                    </button>
                    <button class="user-button" id="btn-otp-modal-close" style="width: auto; padding: 0 20px;">Close</button>
                </div>
            </div>
        `;

        this.cb.showModal(content);
        this.updateOtpModal(initialOtp, remaining);

        const copyAction = async () => {
            const freshOtp = await (window as any).api.generateTOTP(account.secret);
            await navigator.clipboard.writeText(freshOtp);
            this.cb.showToast("Code copied!", "success");
            const codeVessel = document.getElementById('otp-modal-copy');
            if (codeVessel) this.cb.showCopyFeedback(codeVessel);
        };

        document.getElementById('btn-otp-modal-copy')?.addEventListener('click', copyAction);
        document.getElementById('otp-modal-copy')?.addEventListener('click', copyAction);
        document.getElementById('btn-otp-modal-close')?.addEventListener('click', () => {
            this.activeOtpAccount = null;
            this.cb.hideModal();
        });
    }

    // ─── Icon ─────────────────────────────────────────────────────────────────

    public getIcon(issuer: string): string {
        const name = issuer.toLowerCase();

        const icons: { [key: string]: string } = {
            'google': 'fa-brands fa-google', 'github': 'fa-brands fa-github', 'microsoft': 'fa-brands fa-microsoft', 'apple': 'fa-brands fa-apple',
            'amazon': 'fa-brands fa-amazon', 'facebook': 'fa-brands fa-facebook', 'twitter': 'fa-brands fa-twitter', 'discord': 'fa-brands fa-discord',
            'binance': 'fa-solid fa-coins', 'coinbase': 'fa-solid fa-wallet', 'stripe': 'fa-brands fa-stripe', 'paypal': 'fa-brands fa-paypal',
            'slack': 'fa-brands fa-slack', 'instagram': 'fa-brands fa-instagram', 'linkedin': 'fa-brands fa-linkedin', 'twitch': 'fa-brands fa-twitch',
            'spotify': 'fa-brands fa-spotify', 'netflix': 'fa-solid fa-tv', 'steam': 'fa-brands fa-steam', 'epic': 'fa-solid fa-gamepad',
            'dropbox': 'fa-brands fa-dropbox', 'figma': 'fa-brands fa-figma', 'canva': 'fa-solid fa-palette', 'adobe': 'fa-solid fa-pen-nib',
            'shopify': 'fa-brands fa-shopify', 'reddit': 'fa-brands fa-reddit', 'bitbucket': 'fa-brands fa-bitbucket',
            'gitlab': 'fa-brands fa-gitlab', 'heroku': 'fa-solid fa-server', 'digitalocean': 'fa-brands fa-digital-ocean', 'cloudflare': 'fa-brands fa-cloudflare',
            'vercel': 'fa-solid fa-triangle-exclamation', 'netlify': 'fa-solid fa-globe', 'firebase': 'fa-solid fa-flame', 'wordpress': 'fa-brands fa-wordpress',
            'medium': 'fa-brands fa-medium', 'patreon': 'fa-brands fa-patreon', 'discordapp': 'fa-brands fa-discord',
            'protonmail': 'fa-solid fa-envelope', 'nordvpn': 'fa-solid fa-shield-halved', 'expressvpn': 'fa-solid fa-shield-halved',
            'bitwarden': 'fa-solid fa-lock', '1password': 'fa-solid fa-key', 'lastpass': 'fa-solid fa-key',
            'uber': 'fa-brands fa-uber', 'lyft': 'fa-solid fa-car', 'airbnb': 'fa-brands fa-airbnb', 'notion': 'fa-solid fa-file-lines',
            'zoom': 'fa-solid fa-video', 'trello': 'fa-brands fa-trello', 'asana': 'fa-solid fa-list-check', 'clickup': 'fa-solid fa-layer-group'
        };

        if (icons[name]) return icons[name];

        const keywords: [string | RegExp, string][] = [
            [/aws|amazon|cloud/i, 'fa-solid fa-cloud'],
            [/azure|microsoft/i, 'fa-brands fa-microsoft'],
            [/server|host|vps|deploy/i, 'fa-solid fa-server'],
            [/db|database|mongo|sql|redis/i, 'fa-solid fa-database'],
            [/mail|email|outlook|gmail/i, 'fa-solid fa-envelope'],
            [/chat|message|messenger|slack|discord/i, 'fa-solid fa-comment-dots'],
            [/social|network|brand/i, 'fa-solid fa-share-nodes'],
            [/bank|finance|money|wallet|pay/i, 'fa-solid fa-wallet'],
            [/crypto|coin|token|eth|btc/i, 'fa-solid fa-coins'],
            [/card|credit|debit/i, 'fa-solid fa-credit-card'],
            [/auth|security|protect|shield|vault/i, 'fa-solid fa-shield-halved'],
            [/key|password|pass|login|access/i, 'fa-solid fa-key'],
            [/code|dev|git|build|repo/i, 'fa-solid fa-code'],
            [/api|endpoint|webhook/i, 'fa-solid fa-link'],
            [/video|movie|tv|stream|netflix|yt|youtube/i, 'fa-solid fa-video'],
            [/music|audio|song|sound/i, 'fa-solid fa-music'],
            [/game|play|epic|xbox|psn/i, 'fa-solid fa-gamepad'],
            [/shop|store|cart|ebay|buy/i, 'fa-solid fa-cart-shopping'],
            [/user|account|profile|id/i, 'fa-solid fa-user'],
            [/work|corp|company|office/i, 'fa-solid fa-briefcase']
        ];

        for (const [pattern, icon] of keywords) {
            if (typeof pattern === 'string' && name.includes(pattern)) return icon;
            if (pattern instanceof RegExp && pattern.test(name)) return icon;
        }

        return 'fa-solid fa-shield';
    }
}
