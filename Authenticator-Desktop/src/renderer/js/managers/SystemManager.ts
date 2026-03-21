export interface SystemCallbacks {
    getStorageKey: (key: string) => string;
    pushSettings: () => void;
}

export class SystemManager {
    public launchOnStartup: boolean = false;
    public minimizeToTray: boolean = false;
    public globalHotkey: boolean = false;

    constructor(private cb: SystemCallbacks) {}

    initSystemIntegration() {
        const startupToggle = document.getElementById('launch-on-startup-toggle') as HTMLInputElement;
        const trayToggle = document.getElementById('minimize-to-tray-toggle') as HTMLInputElement;
        const hotkeyToggle = document.getElementById('global-hotkey-toggle') as HTMLInputElement;

        // Load initial states
        this.launchOnStartup = localStorage.getItem(this.cb.getStorageKey('launch_on_startup')) === 'true';
        this.minimizeToTray = localStorage.getItem(this.cb.getStorageKey('minimize_to_tray')) === 'true';
        this.globalHotkey = localStorage.getItem(this.cb.getStorageKey('global_hotkey')) === 'true';

        if (startupToggle) startupToggle.checked = this.launchOnStartup;
        if (trayToggle) trayToggle.checked = this.minimizeToTray;
        if (hotkeyToggle) hotkeyToggle.checked = this.globalHotkey;

        // Apply to main process on start
        (window as any).api.setLaunchOnStartup(this.launchOnStartup);
        (window as any).api.setMinimizeToTray(this.minimizeToTray);
        (window as any).api.setGlobalHotkey(this.globalHotkey);

        startupToggle?.addEventListener('change', () => {
            this.launchOnStartup = startupToggle.checked;
            (window as any).api.setLaunchOnStartup(this.launchOnStartup);
            localStorage.setItem(this.cb.getStorageKey('launch_on_startup'), String(this.launchOnStartup));
            this.cb.pushSettings();
        });

        trayToggle?.addEventListener('change', () => {
            this.minimizeToTray = trayToggle.checked;
            (window as any).api.setMinimizeToTray(this.minimizeToTray);
            localStorage.setItem(this.cb.getStorageKey('minimize_to_tray'), String(this.minimizeToTray));
            this.cb.pushSettings();
        });

        hotkeyToggle?.addEventListener('change', () => {
            this.globalHotkey = hotkeyToggle.checked;
            (window as any).api.setGlobalHotkey(this.globalHotkey);
            localStorage.setItem(this.cb.getStorageKey('global_hotkey'), String(this.globalHotkey));
            this.cb.pushSettings();
        });
    }

    applyLaunchOnStartup(value: boolean) {
        this.launchOnStartup = value;
        const t = document.getElementById('launch-on-startup-toggle') as HTMLInputElement;
        if (t) t.checked = this.launchOnStartup;
        (window as any).api.setLaunchOnStartup(this.launchOnStartup);
    }

    applyMinimizeToTray(value: boolean) {
        this.minimizeToTray = value;
        const t = document.getElementById('minimize-to-tray-toggle') as HTMLInputElement;
        if (t) t.checked = this.minimizeToTray;
        (window as any).api.setMinimizeToTray(this.minimizeToTray);
    }

    applyGlobalHotkey(value: boolean) {
        this.globalHotkey = value;
        const t = document.getElementById('global-hotkey-toggle') as HTMLInputElement;
        if (t) t.checked = this.globalHotkey;
        (window as any).api.setGlobalHotkey(this.globalHotkey);
    }
}
