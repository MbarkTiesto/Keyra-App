import * as fs from 'fs';
import * as path from 'path';
import { app, ipcMain } from 'electron';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';

export interface NotificationOptions {
    to: string;
    message: string;
    code: string;
}

class NotifierService {
    private waClient: Client | null = null;
    private isWaReady = false;
    private waQrData: string | null = null;
    private isInitializing = false;

    constructor() {
        // WhatsApp no longer initializes automatically on startup.
        // It is now strictly triggered by the user via ensureWhatsAppStarted()
    }

    public ensureWhatsAppStarted() {
        if (this.waClient && (this.isWaReady || this.isInitializing)) return;
        this.initWhatsApp();
    }

    private async initWhatsApp() {
        if (this.isInitializing) {
            console.log("[Notifier] Initialization already in progress, skipping.");
            return;
        }
        this.isInitializing = true;
        
        console.log("[Notifier] Starting WhatsApp Initialization flow...");
        
        // Safety: If a client exists, destroy it properly before re-init
        if (this.waClient) {
            console.log("[Notifier] Cleaning up existing WhatsApp client...");
            try {
                // Racing destroy() with a 5s timeout to prevent hanging the whole service
                await Promise.race([
                    this.waClient.destroy(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Destruction Timeout")), 5000))
                ]);
            } catch (e) {
                console.warn("[Notifier] Forced client cleanup due to:", e instanceof Error ? e.message : e);
            }
            this.waClient = null;
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Force fresh session by deleting the data directory before every init
        const sessionPath = path.join(app.getPath('userData'), 'wa-session');
        if (fs.existsSync(sessionPath)) {
            console.log("[Notifier] Forcing fresh session: Deleting existing wa-session...");
            try {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log("[Notifier] Local session data cleared.");
            } catch (err) {
                console.warn("[Notifier] Failed to clear local session data:", err);
            }
        }

        this.broadcastStatus('wa-initializing');

        const launchOptions = {
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials'
            ],
            protocolTimeout: 0 // Infinite timeout for script injection
        };

        console.log("[Notifier] Creating Client instance...");
        try {
            this.waClient = new Client({
                authStrategy: new LocalAuth({
                    dataPath: path.join(app.getPath('userData'), 'wa-session')
                }),
                puppeteer: launchOptions
            });
        } catch (e) {
            console.error("[Notifier] Failed to create Client instance:", e);
            this.resetState();
            return;
        }

        console.log("[Notifier] Client instance created. Registering listeners...");

        this.waClient.on('qr', async (qr) => {
            console.log("[Notifier] WhatsApp QR Code received");
            this.isInitializing = false;
            this.waQrData = await qrcode.toDataURL(qr);
            this.broadcastStatus('wa-qr-code', this.waQrData);
        });

        this.waClient.on('authenticated', () => {
            console.log("[Notifier] WhatsApp Client AUTHENTICATED (Pre-Ready)");
            this.broadcastStatus('wa-authenticated');
        });

        this.waClient.on('ready', () => {
            const waNumber = this.waClient?.info.wid.user;
            console.log(`[Notifier] WhatsApp Client is READY. Number: ${waNumber}`);
            this.isWaReady = true;
            this.isInitializing = false;
            this.waQrData = null;
            this.broadcastStatus('wa-ready', waNumber);
        });

        this.waClient.on('auth_failure', (msg) => {
            console.error("[Notifier] WhatsApp Auth Failure:", msg);
            this.resetState();
            this.broadcastStatus('wa-auth-failure', msg);
        });

        this.waClient.on('disconnected', () => {
            console.log("[Notifier] WhatsApp Client DISCONNECTED");
            this.resetState();
        });

        console.log("[Notifier] Calling initialize()...");
        const start = Date.now();
        this.waClient.initialize()
            .then(() => {
                const duration = ((Date.now() - start) / 1000).toFixed(1);
                console.log(`[Notifier] Global initialize() resolved after ${duration}s.`);
            })
            .catch(err => {
                const duration = ((Date.now() - start) / 1000).toFixed(1);
                console.error(`[Notifier] Initialization failed after ${duration}s:`, err);
                this.resetState();
                this.broadcastStatus('wa-auth-failure', err.message);
            });
    }

    private resetState() {
        this.isInitializing = false;
        this.isWaReady = false;
        this.waQrData = null;
    }

    private broadcastStatus(event: string, data?: any) {
        const { BrowserWindow } = require('electron');
        BrowserWindow.getAllWindows().forEach((win: any) => {
            win.webContents.send(event, data);
        });
    }

    public getWaStatus() {
        return {
            ready: this.isWaReady,
            qr: this.waQrData,
            initializing: this.isInitializing,
            waNumber: this.isWaReady ? this.waClient?.info.wid.user : null
        };
    }

    public async stopWhatsApp() {
        if (!this.waClient) {
            this.resetState();
            return { success: true };
        }
        console.log("[Notifier] Stopping WhatsApp client (modal closed)...");
        try {
            await Promise.race([
                this.waClient.destroy(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Destroy timeout")), 5000))
            ]);
        } catch (e) {
            console.warn("[Notifier] Forced stop:", e instanceof Error ? e.message : e);
        }
        this.waClient = null;
        this.resetState();
        // Clean up session so next open always shows a fresh QR
        const sessionPath = path.join(app.getPath('userData'), 'wa-session');
        if (fs.existsSync(sessionPath)) {
            try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (_) {}
        }
        return { success: true };
    }

    public async logoutWhatsApp() {
        if (this.waClient) {
            try {
                await this.waClient.logout();
                this.resetState();
                // Session is also handled by LocalAuth. If we want a full clear:
                const sessionPath = path.join(app.getPath('userData'), 'wa-session');
                if (fs.existsSync(sessionPath)) {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                }
                this.initWhatsApp(); // Re-init to get new QR
                return { success: true };
            } catch (err: any) {
                console.error("[Notifier] Logout failed:", err);
                return { success: false, message: err.message };
            }
        }
        return { success: false, message: "Client not initialized" };
    }

    public async sendWhatsApp(to: string, message: string): Promise<boolean> {
        if (!this.waClient || !this.isWaReady) {
            console.error("[Notifier] WhatsApp not ready");
            return false;
        }

        try {
            const formattedTo = to.replace(/\+/g, '').replace(/ /g, '') + "@c.us";
            await this.waClient.sendMessage(formattedTo, message);
            return true;
        } catch (err) {
            console.error("[Notifier] WhatsApp send failed:", err);
            return false;
        }
    }
}

export const service = new NotifierService();

export async function sendPhoneVerification(options: NotificationOptions): Promise<{ success: boolean; message: string }> {
    const waSuccess = await service.sendWhatsApp(options.to, options.message);

    if (waSuccess) {
        return { success: true, message: "Verification code sent via WhatsApp." };
    }

    const status = service.getWaStatus();
    return { 
        success: false, 
        message: status.ready ? "Failed to send code via WhatsApp." : 
                 status.initializing ? "WhatsApp is still connecting. Please wait." :
                 "WhatsApp not linked. Please link your account first." 
    };
}

// IPC Handlers for WhatsApp linking
ipcMain.handle('get-wa-status', () => service.getWaStatus());
