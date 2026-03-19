export type TabName = 'vault' | 'settings' | 'account';

export interface NavigationCallbacks {
    onTabSwitch: (tab: TabName) => void;
    updateLastActivity: (action: string) => void;
}

export class NavigationManager {
    private currentTab: TabName = 'vault';

    constructor(private cb: NavigationCallbacks) {}

    init() {
        // Nav tab clicks
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tabName = target.getAttribute('data-tab') as TabName;
                this.switchTab(tabName);
                this.cb.updateLastActivity(`Viewed ${tabName}`);
            });
        });

        // Account nav from dropdown
        document.getElementById('account-settings-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('user-dropdown')?.classList.remove('show');
            this.switchTab('account');
            this.cb.updateLastActivity('Opened Account Settings');
        });

        // User dropdown toggle
        const dropdownBtn = document.getElementById('user-dropdown-btn');
        const dropdownMenu = document.getElementById('user-dropdown');
        dropdownBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu?.classList.toggle('show');
        });
        document.addEventListener('click', () => {
            dropdownMenu?.classList.remove('show');
        });
    }

    switchTab(tab: TabName) {
        this.currentTab = tab;

        document.querySelectorAll('.nav-tab').forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-tab') === tab);
        });

        ['vault-view', 'settings-view', 'account-view'].forEach(viewId => {
            const el = document.getElementById(viewId);
            if (el) el.classList.toggle('hidden', viewId !== `${tab}-view`);
        });

        this.cb.onTabSwitch(tab);
    }

    getCurrentTab(): TabName {
        return this.currentTab;
    }
}
