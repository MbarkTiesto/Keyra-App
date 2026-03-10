export { };

declare global {
    interface Window {
        api: {
            generateTOTP(secret: string): Promise<string>;
            saveAccount(acc: any): Promise<void>;
            deleteAccount(id: string): Promise<void>;
            getRemainingSeconds(): Promise<number>;
            getAccounts(): Promise<any>;
            parseURI(uri: string): Promise<any>;
            minimize(): void;
            maximize(): void;
            close(): void;
        };
    }
}
