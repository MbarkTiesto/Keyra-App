export interface SettingsCallbacks {
    getStorageKey: (key: string) => string;
    pushSettings: () => Promise<any>;
    showToast: (msg: string, type: 'info' | 'success' | 'error') => void;
    updateLastActivity: (action: string) => void;
    setTheme: (theme: string, silent?: boolean) => void;
    setAccentColor: (accent: string, silent?: boolean) => void;
    getCurrentTheme: () => string;
    getAccentColor: () => string;
    applyOledMode: (enabled: boolean) => void;
    getOledMode: () => boolean;
    applyPerformanceMode: (enabled: boolean) => void;
    getPerformanceMode: () => boolean;
    applyPrivacyMode: (enabled: boolean, save: boolean) => void;
    getPrivacyMode: () => boolean;
    applyScreenGuardian: (enabled: boolean, save: boolean) => void;
    getScreenGuardian: () => boolean;
    applyPrivacyBlur: (enabled: boolean, save: boolean) => void;
    getPrivacyBlur: () => boolean;
    applyVaultViewStyle: (style: 'unified' | 'compact' | 'secure') => void;
    getVaultViewStyle: () => string;
    applyLaunchOnStartup: (enabled: boolean) => void;
    getLaunchOnStartup: () => boolean;
    applyMinimizeToTray: (enabled: boolean) => void;
    getMinimizeToTray: () => boolean;
    applyGlobalHotkey: (enabled: boolean) => void;
    getGlobalHotkey: () => boolean;
    getAutoCheckUpdates: () => boolean;
    setAutoCheckUpdates: (val: boolean) => void;
    getWallpaperPreset: () => string;
    getVaultPin: () => string | null;
    updateLockVaultVisibility: () => void;
    renderAccounts: () => void;
    setupAccentColorSelectorInTheme: (onChange: (accent: string) => void) => void;
}

export class SettingsManager {
    public menuExitIntegration: boolean = false;
    public windowResizable: boolean = false;

    constructor(private cb: SettingsCallbacks) {}

    init() {
        this.initMenuExitIntegration();
        this.initWindowResizable();
    }

    initSegmentedStates() {
        this.updateSegmentedUI('theme-segmented', localStorage.getItem(this.cb.getStorageKey('theme')) || 'auto');
        this.updateSegmentedUI('autolock-segmented', localStorage.getItem(this.cb.getStorageKey('autolock')) || '0');
        this.updateSegmentedUI('countdown-style-segmented', this.cb.getVaultViewStyle());
    }

    updateSegmentedUI(containerId: string, value: string) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const segments = container.querySelectorAll('.segment');
        const indicator = container.querySelector('.segment-indicator') as HTMLElement;
        let activeIdx = 0;
        segments.forEach((seg, idx) => {
            const isActive = seg.getAttribute('data-val') === value;
            seg.classList.toggle('active', isActive);
            if (isActive) activeIdx = idx;
        });
        if (indicator) {
            const segmentWidth = 100 / segments.length;
            indicator.style.width = `calc(${segmentWidth}% - 6px)`;
            indicator.style.left = `calc(${activeIdx * segmentWidth}% + 3px)`;
        }
    }

    initMenuExitIntegration() {
        this.menuExitIntegration = localStorage.getItem(this.cb.getStorageKey('menu_exit_integration')) === 'true';
        const toggle = document.getElementById('menu-exit-toggle') as HTMLInputElement;
        if (toggle) toggle.checked = this.menuExitIntegration;
        this.updateCloseButtonVisibility();
    }

    updateCloseButtonVisibility() {
        const navBtn = document.getElementById('btn-close-app');
        const menuBtn = document.getElementById('menu-close-app-btn');
        if (navBtn) navBtn.classList.toggle('hidden', this.menuExitIntegration);
        if (menuBtn) menuBtn.classList.toggle('hidden', !this.menuExitIntegration);
    }

    initWindowResizable() {
        this.windowResizable = localStorage.getItem(this.cb.getStorageKey('window_resizable')) === 'true';
        const toggle = document.getElementById('window-resizable-toggle') as HTMLInputElement;
        if (toggle) toggle.checked = this.windowResizable;
        (window as any).api.setResizable(this.windowResizable);
    }

    setupAccentColorSelector() {
        this.cb.setupAccentColorSelectorInTheme((accent) => {
            this.cb.setAccentColor(accent);
            this.cb.showToast("Color updated!", "success");
            this.cb.updateLastActivity(`Changed color to ${accent}`);
        });
        const savedAccent = this.cb.getAccentColor();
        this.cb.setAccentColor(savedAccent, true);
    }

    getSettingsObject(): any {
        return {
            "Desktop Settings": {
                theme: localStorage.getItem(this.cb.getStorageKey('theme')) || 'auto',
                accentColor: this.cb.getAccentColor(),
                wallpaperPreset: this.cb.getWallpaperPreset(),
                privacyMode: this.cb.getPrivacyMode(),
                screenGuardian: this.cb.getScreenGuardian(),
                autolock: localStorage.getItem(this.cb.getStorageKey('autolock')) || '0',
                oledMode: this.cb.getOledMode(),
                performanceMode: this.cb.getPerformanceMode(),
                menuExitIntegration: this.menuExitIntegration,
                privacyBlur: this.cb.getPrivacyBlur(),
                windowResizable: this.windowResizable,
                launchOnStartup: this.cb.getLaunchOnStartup(),
                minimizeToTray: this.cb.getMinimizeToTray(),
                globalHotkey: this.cb.getGlobalHotkey(),
                autoCheckUpdates: this.cb.getAutoCheckUpdates(),
                vaultViewStyle: this.cb.getVaultViewStyle(),
                vaultPin: this.cb.getVaultPin(),
            }
        };
    }

    applySettings(settings: any, saveLocal: boolean = true) {
        if (!settings) return;

        if (settings.theme) this.cb.setTheme(settings.theme, true);
        if (settings.accentColor) this.cb.setAccentColor(settings.accentColor, true);

        this.cb.applyPrivacyMode(!!settings.privacyMode, false);
        this.cb.applyScreenGuardian(!!settings.screenGuardian, false);

        if (settings.autolock !== undefined) {
            this.updateSegmentedUI('autolock-segmented', String(settings.autolock));
        }

        if (settings.launchOnStartup !== undefined) this.cb.applyLaunchOnStartup(!!settings.launchOnStartup);
        if (settings.minimizeToTray !== undefined) this.cb.applyMinimizeToTray(!!settings.minimizeToTray);
        if (settings.globalHotkey !== undefined) this.cb.applyGlobalHotkey(!!settings.globalHotkey);
        if (settings.vaultViewStyle !== undefined) this.cb.applyVaultViewStyle(settings.vaultViewStyle as 'unified' | 'compact' | 'secure');

        if (settings.oledMode !== undefined) {
            this.cb.applyOledMode(!!settings.oledMode);
            const oledToggle = document.getElementById('oled-mode-toggle') as HTMLInputElement;
            if (oledToggle) oledToggle.checked = this.cb.getOledMode();
            this.cb.setAccentColor(this.cb.getAccentColor(), true);
        }

        if (settings.performanceMode !== undefined) {
            this.cb.applyPerformanceMode(!!settings.performanceMode);
            const perfToggle = document.getElementById('performance-mode-toggle') as HTMLInputElement;
            if (perfToggle) perfToggle.checked = this.cb.getPerformanceMode();
        }

        if (settings.menuExitIntegration !== undefined) {
            this.menuExitIntegration = !!settings.menuExitIntegration;
            const menuExitToggle = document.getElementById('menu-exit-toggle') as HTMLInputElement;
            if (menuExitToggle) menuExitToggle.checked = this.menuExitIntegration;
            this.updateCloseButtonVisibility();
        }

        if (settings.privacyBlur !== undefined) this.cb.applyPrivacyBlur(!!settings.privacyBlur, false);

        if (settings.autoCheckUpdates !== undefined) {
            this.cb.setAutoCheckUpdates(!!settings.autoCheckUpdates);
            const autoToggle = document.getElementById('auto-update-toggle') as HTMLInputElement;
            if (autoToggle) autoToggle.checked = this.cb.getAutoCheckUpdates();
        }

        if (settings.windowResizable !== undefined) {
            this.windowResizable = !!settings.windowResizable;
            const resizableToggle = document.getElementById('window-resizable-toggle') as HTMLInputElement;
            if (resizableToggle) resizableToggle.checked = this.windowResizable;
            (window as any).api.setResizable(this.windowResizable);
        }

        if (saveLocal) {
            if (settings.theme) localStorage.setItem(this.cb.getStorageKey('theme'), settings.theme);
            if (settings.accentColor) localStorage.setItem(this.cb.getStorageKey('accent_color'), settings.accentColor);
            if (settings.wallpaperPreset) localStorage.setItem(this.cb.getStorageKey('wallpaperPreset'), settings.wallpaperPreset);
            localStorage.setItem(this.cb.getStorageKey('privacyMode'), String(this.cb.getPrivacyMode()));
            localStorage.setItem(this.cb.getStorageKey('screenGuardian'), String(this.cb.getScreenGuardian()));
            if (settings.autolock !== undefined) localStorage.setItem(this.cb.getStorageKey('autolock'), String(settings.autolock));
            localStorage.setItem(this.cb.getStorageKey('oled_mode'), String(this.cb.getOledMode()));
            localStorage.setItem(this.cb.getStorageKey('performance_mode'), String(this.cb.getPerformanceMode()));
            localStorage.setItem(this.cb.getStorageKey('menu_exit_integration'), String(this.menuExitIntegration));
            localStorage.setItem(this.cb.getStorageKey('privacy_blur'), String(this.cb.getPrivacyBlur()));
            localStorage.setItem(this.cb.getStorageKey('window_resizable'), String(this.windowResizable));
            localStorage.setItem(this.cb.getStorageKey('auto_check_updates'), String(this.cb.getAutoCheckUpdates()));
            localStorage.setItem(this.cb.getStorageKey('vault_view_style'), this.cb.getVaultViewStyle());
            if (settings.vaultPin !== undefined) localStorage.setItem(this.cb.getStorageKey('vault_pin'), settings.vaultPin);
        }

        this.cb.updateLockVaultVisibility();
        this.cb.renderAccounts();
    }

    setupEventListeners() {
        // Segmented Theme Toggle
        document.querySelectorAll('#theme-segmented .segment').forEach(seg => {
            seg.addEventListener('click', (e) => {
                const val = (e.currentTarget as HTMLElement).getAttribute('data-val')!;
                this.cb.setTheme(val);
                this.cb.updateLastActivity(`Changed appearance to ${val}`);
                this.cb.showToast(val === 'auto' ? "App will now follow system theme" : `${val.charAt(0).toUpperCase() + val.slice(1)} mode enabled`, "info");
            });
        });

        // Segmented Auto-Lock
        document.querySelectorAll('#autolock-segmented .segment').forEach(seg => {
            seg.addEventListener('click', (e) => {
                const val = (e.currentTarget as HTMLElement).getAttribute('data-val')!;
                localStorage.setItem(this.cb.getStorageKey('autolock'), val);
                this.updateSegmentedUI('autolock-segmented', val);
                this.cb.pushSettings();
                this.cb.showToast(val === '0' ? 'Auto-lock turned off' : `Locked after ${val}m of inactivity`, "info");
                this.cb.updateLastActivity(`Changed autolock to ${val}m`);
            });
        });

        // OLED Mode Toggle
        document.getElementById('oled-mode-toggle')?.addEventListener('change', (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            this.cb.applyOledMode(enabled);
            this.cb.setAccentColor(this.cb.getAccentColor(), true);
            this.cb.pushSettings();
            if (enabled && this.cb.getCurrentTheme() !== 'dark') {
                this.cb.showToast("Pure Black only works in Dark Mode", "info");
            } else {
                this.cb.showToast(enabled ? "Pure Black (OLED) Activated" : "Standard Dark Mode Restored", "success");
            }
            this.cb.updateLastActivity(`OLED Mode ${enabled ? 'on' : 'off'}`);
        });

        // Performance Mode Toggle
        document.getElementById('performance-mode-toggle')?.addEventListener('change', (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            this.cb.applyPerformanceMode(enabled);
            this.cb.pushSettings();
            this.cb.showToast(enabled ? "Performance Mode is on" : "Performance Mode is off", "info");
            this.cb.updateLastActivity(`Performance Mode ${enabled ? 'on' : 'off'}`);
        });

        // Menu Exit Toggle
        document.getElementById('menu-exit-toggle')?.addEventListener('change', (e) => {
            this.menuExitIntegration = (e.target as HTMLInputElement).checked;
            localStorage.setItem(this.cb.getStorageKey('menu_exit_integration'), String(this.menuExitIntegration));
            this.updateCloseButtonVisibility();
            this.cb.pushSettings();
            this.cb.showToast(this.menuExitIntegration ? "Close button moved to menu" : "Close button moved to navbar", "info");
            this.cb.updateLastActivity(`Menu Exit ${this.menuExitIntegration ? 'on' : 'off'}`);
        });

        // Privacy Mode Toggle
        document.getElementById('privacy-mode-toggle')?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            this.cb.applyPrivacyMode(checked, true);
            this.cb.pushSettings();
            this.cb.renderAccounts();
            this.cb.showToast(this.cb.getPrivacyMode() ? "Codes are now hidden" : "Codes are now visible", "info");
            this.cb.updateLastActivity(`Hide Codes ${checked ? 'on' : 'off'}`);
        });

        // Screen Guardian Toggle
        document.getElementById('screen-guardian-toggle')?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            this.cb.applyScreenGuardian(checked, true);
            this.cb.pushSettings();
            this.cb.showToast(this.cb.getScreenGuardian() ? "Screenshot protection is on" : "Screenshot protection is off", "info");
            this.cb.updateLastActivity(`Anti-Peek ${checked ? 'on' : 'off'}`);
        });

        // Privacy Blur Toggle
        document.getElementById('privacy-blur-toggle')?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            this.cb.applyPrivacyBlur(checked, true);
            this.cb.pushSettings();
            this.cb.showToast(this.cb.getPrivacyBlur() ? "Auto-blur is on" : "Auto-blur is off", "info");
            this.cb.updateLastActivity(`Auto-blur ${checked ? 'on' : 'off'}`);
        });

        // Window Resizable Toggle
        document.getElementById('window-resizable-toggle')?.addEventListener('change', (e) => {
            this.windowResizable = (e.target as HTMLInputElement).checked;
            localStorage.setItem(this.cb.getStorageKey('window_resizable'), String(this.windowResizable));
            (window as any).api.setResizable(this.windowResizable);
            this.cb.pushSettings();
            this.cb.showToast(this.windowResizable ? "App is now resizable" : "App is now fixed size", "info");
            this.cb.updateLastActivity(`Window resizing ${this.windowResizable ? 'on' : 'off'}`);
        });

        // Accent Color
        this.setupAccentColorSelector();
    }
}
