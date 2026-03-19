export interface ConnectivityCallbacks {
    showToast: (msg: string, type: 'info' | 'success' | 'error') => void;
}

export class ConnectivityManager {
    constructor(private cb: ConnectivityCallbacks) {}

    init() {
        this.updateStatus();
        window.addEventListener('online', () => this.updateStatus());
        window.addEventListener('offline', () => this.updateStatus());

        const statusEl = document.getElementById('connectivity-status');
        if (statusEl) {
            statusEl.addEventListener('click', () => {
                statusEl.classList.toggle('expanded');
                if (statusEl.classList.contains('expanded')) {
                    setTimeout(() => statusEl.classList.remove('expanded'), 5000);
                }
            });
        }
    }

    updateStatus() {
        const isOnline = navigator.onLine;
        const statusEl = document.getElementById('connectivity-status');
        const textEl = document.getElementById('status-text');

        if (statusEl && textEl) {
            statusEl.classList.toggle('online', isOnline);
            statusEl.classList.toggle('offline', !isOnline);
            textEl.textContent = isOnline ? 'Online' : 'Offline';
        }

        if (!isOnline) {
            this.cb.showToast("You're offline", 'info');
        }
    }
}
