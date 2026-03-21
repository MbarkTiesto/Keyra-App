export interface PrivacyCallbacks {
    getStorageKey: (key: string) => string;
}

export class PrivacyManager {
    public privacyMode: boolean = false;
    public screenGuardian: boolean = false;
    public privacyBlur: boolean = false;

    constructor(private cb: PrivacyCallbacks) {}

    initPrivacyMode() {
        this.privacyMode = localStorage.getItem(this.cb.getStorageKey('privacyMode')) === 'true';
        const toggle = document.getElementById('privacy-mode-toggle') as HTMLInputElement;
        if (toggle) toggle.checked = this.privacyMode;
    }

    initScreenGuardian() {
        this.screenGuardian = localStorage.getItem(this.cb.getStorageKey('screenGuardian')) === 'true';
        const toggle = document.getElementById('screen-guardian-toggle') as HTMLInputElement;
        if (toggle) toggle.checked = this.screenGuardian;
        (window as any).api.setContentProtection(this.screenGuardian);
    }

    initInteractivePrivacy() {
        this.privacyBlur = localStorage.getItem(this.cb.getStorageKey('privacy_blur')) === 'true';
        const toggle = document.getElementById('privacy-blur-toggle') as HTMLInputElement;
        if (toggle) toggle.checked = this.privacyBlur;

        document.documentElement.addEventListener('mouseleave', (e) => {
            if (!e.relatedTarget && this.privacyBlur) this.showOverlay();
        });

        document.documentElement.addEventListener('mouseenter', () => {
            if (this.privacyBlur) this.hideOverlay();
        });

        window.addEventListener('blur', () => {
            if (this.privacyBlur || this.screenGuardian) this.showOverlay();
        });

        window.addEventListener('focus', () => {
            if (this.privacyBlur || this.screenGuardian) this.hideOverlay();
        });
    }

    showOverlay() {
        const authVessel = document.getElementById('auth-vessel');
        if (authVessel?.classList.contains('show')) return;
        document.getElementById('privacy-blur-overlay')?.classList.add('show');
    }

    hideOverlay() {
        document.getElementById('privacy-blur-overlay')?.classList.remove('show');
    }

    applyPrivacyMode(value: boolean, saveLocal: boolean) {
        this.privacyMode = value;
        const toggle = document.getElementById('privacy-mode-toggle') as HTMLInputElement;
        if (toggle) toggle.checked = this.privacyMode;
        if (saveLocal) localStorage.setItem(this.cb.getStorageKey('privacyMode'), String(this.privacyMode));
    }

    applyScreenGuardian(value: boolean, saveLocal: boolean) {
        this.screenGuardian = value;
        const toggle = document.getElementById('screen-guardian-toggle') as HTMLInputElement;
        if (toggle) toggle.checked = this.screenGuardian;
        (window as any).api.setContentProtection(this.screenGuardian);
        if (saveLocal) localStorage.setItem(this.cb.getStorageKey('screenGuardian'), String(this.screenGuardian));
    }

    applyPrivacyBlur(value: boolean, saveLocal: boolean) {
        this.privacyBlur = value;
        const toggle = document.getElementById('privacy-blur-toggle') as HTMLInputElement;
        if (toggle) toggle.checked = this.privacyBlur;
        if (saveLocal) localStorage.setItem(this.cb.getStorageKey('privacy_blur'), String(this.privacyBlur));
    }
}
