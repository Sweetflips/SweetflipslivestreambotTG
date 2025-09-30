export interface LinkedAccount {
    telegramId: string;
    telegramUsername: string;
    kickUsername: string;
    linkedAt: Date;
    role: string;
}
export declare class GoogleSheetsService {
    private sheets;
    private spreadsheetId;
    private range;
    constructor();
    private initializeSheets;
    private initializeSheet;
    addLinkedAccount(account: LinkedAccount): Promise<boolean>;
    getAllLinkedAccounts(): Promise<LinkedAccount[]>;
    updateAccountRole(telegramId: string, newRole: string): Promise<boolean>;
}
export declare const googleSheetsService: GoogleSheetsService;
//# sourceMappingURL=googleSheets.d.ts.map