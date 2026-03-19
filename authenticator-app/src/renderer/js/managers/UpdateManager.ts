export interface UpdateCallbacks {
    pushSettings: () => void;
    showToast: (msg: string, type: 'info' | 'success' | 'error') => void;
    setLoading: (show: boolean, title?: string, subtitle?: string) => void;
}

export class UpdateManager {
    public autoCheckUpdates: boolean = true;

    constructor(private cb: UpdateCallbacks) {}

    init() {
        const checkBtn = document.getElementById('btn-check-updates');
        const downloadBtn = document.getElementById('btn-download-update');
        const installBtn = document.getElementById('btn-install-update');
        const message = document.getElementById('update-message');
        const badge = document.getElementById('update-status-badge');
        const progressContainer = document.getElementById('download-progress-container');
        const progressBar = document.getElementById('download-progress-bar');
        const percentText = document.getElementById('download-percent-text');
        const versionText = document.getElementById('current-version-text');
        const nmLoader = document.getElementById('nm-update-loader');

        if (versionText) versionText.textContent = `Version 1.2.0`;

        checkBtn?.addEventListener('click', () => {
            this.cb.setLoading(true, "Checking Updates", "CONTACTING KEYRA SERVERS");
            if (message) message.textContent = 'Checking for updates...';
            nmLoader?.classList.remove('hidden');
            (window as any).api.checkForUpdates();
        });

        downloadBtn?.addEventListener('click', () => {
            (window as any).api.startDownload();
            downloadBtn.classList.add('hidden');
            progressContainer?.classList.remove('hidden');
        });

        installBtn?.addEventListener('click', () => {
            (window as any).api.installUpdate();
        });

        (window as any).api.onUpdateChecking(() => {
            if (message) message.textContent = 'Contacting update server...';
        });

        (window as any).api.onUpdateAvailable((info: any) => {
            nmLoader?.classList.add('hidden');
            if (message) message.textContent = `Update available: v${info.version}`;
            badge?.classList.remove('hidden');
            checkBtn?.classList.add('hidden');
            if (downloadBtn) {
                downloadBtn.classList.remove('hidden');
                const span = downloadBtn.querySelector('span');
                if (span) span.textContent = `Download v${info.version}`;
            }
        });

        (window as any).api.onUpdateNotAvailable(() => {
            this.cb.setLoading(false);
            nmLoader?.classList.add('hidden');
            if (message) message.textContent = 'Your app is up to date.';
            checkBtn?.classList.remove('hidden');
        });

        (window as any).api.onUpdateError((err: string) => {
            this.cb.setLoading(false);
            nmLoader?.classList.add('hidden');
            if (message) message.textContent = `Update check failed.`;
            console.error("Update Error:", err);
            checkBtn?.classList.remove('hidden');
        });

        (window as any).api.onDownloadProgress((percent: number) => {
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (percentText) percentText.textContent = `${Math.round(percent)}%`;
            if (message) message.textContent = 'Downloading update...';
        });

        (window as any).api.onUpdateDownloaded(() => {
            if (message) message.textContent = 'Update ready to install.';
            progressContainer?.classList.add('hidden');
            installBtn?.classList.remove('hidden');
            this.cb.showToast("Update ready to install!", "success");
        });

        const autoToggle = document.getElementById('auto-update-toggle') as HTMLInputElement;
        autoToggle?.addEventListener('change', () => {
            this.autoCheckUpdates = autoToggle.checked;
            this.cb.pushSettings();
        });

        setTimeout(() => {
            if (this.autoCheckUpdates) (window as any).api.checkForUpdates();
        }, 3000);
    }
}
