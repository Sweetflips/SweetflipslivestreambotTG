import { google } from 'googleapis';
import { logger } from '../telemetry/logger.js';
export class GoogleSheetsService {
    sheets;
    spreadsheetId;
    range;
    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
        this.range = 'Sheet1!A:F'; // A: Telegram ID, B: Telegram Username, C: Kick Username, D: Linked Date, E: Role, F: Timestamp
        if (!this.spreadsheetId) {
            logger.warn('Google Sheets ID not configured. Sheets integration disabled.');
            return;
        }
        this.initializeSheets();
    }
    async initializeSheets() {
        try {
            // For service account authentication
            const auth = new google.auth.GoogleAuth({
                keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ?? undefined,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            this.sheets = google.sheets({ version: 'v4', auth });
            // Initialize the sheet with headers if it doesn't exist
            await this.initializeSheet();
            logger.info('Google Sheets service initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize Google Sheets service:', error);
        }
    }
    async initializeSheet() {
        try {
            // Check if sheet exists and has headers
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Sheet1!A1:F1',
            });
            const values = response.data.values;
            // If no headers exist, add them
            if (!values || values.length === 0) {
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Sheet1!A1:F1',
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [
                            [
                                'Telegram ID',
                                'Telegram Username',
                                'Kick Username',
                                'Linked Date',
                                'Role',
                                'Timestamp',
                            ],
                        ],
                    },
                });
                logger.info('Google Sheets headers initialized');
            }
        }
        catch (error) {
            logger.error('Failed to initialize sheet headers:', error);
        }
    }
    async addLinkedAccount(account) {
        if (!this.sheets) {
            logger.warn('Google Sheets not initialized. Skipping account sync.');
            return false;
        }
        try {
            const values = [
                [
                    account.telegramId,
                    account.telegramUsername,
                    account.kickUsername,
                    account.linkedAt.toISOString().split('T')[0], // Date only
                    account.role,
                    new Date().toISOString(),
                ],
            ];
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: this.range,
                valueInputOption: 'RAW',
                requestBody: {
                    values,
                },
            });
            logger.info(`Linked account synced to Google Sheets: ${account.telegramUsername} -> ${account.kickUsername}`);
            return true;
        }
        catch (error) {
            logger.error('Failed to sync account to Google Sheets:', error);
            return false;
        }
    }
    async getAllLinkedAccounts() {
        if (!this.sheets) {
            logger.warn('Google Sheets not initialized. Cannot fetch accounts.');
            return [];
        }
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: this.range,
            });
            const values = response.data.values;
            if (!values || values.length <= 1) {
                return []; // No data or only headers
            }
            // Skip header row and convert to LinkedAccount objects
            return values.slice(1).map((row) => ({
                telegramId: row[0] || '',
                telegramUsername: row[1] || '',
                kickUsername: row[2] || '',
                linkedAt: new Date(row[3] || ''),
                role: row[4] || 'VIEWER',
            }));
        }
        catch (error) {
            logger.error('Failed to fetch accounts from Google Sheets:', error);
            return [];
        }
    }
    async updateAccountRole(telegramId, newRole) {
        if (!this.sheets) {
            logger.warn('Google Sheets not initialized. Cannot update role.');
            return false;
        }
        try {
            // Get all data to find the row
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: this.range,
            });
            const values = response.data.values;
            if (!values || values.length <= 1) {
                return false;
            }
            // Find the row with matching Telegram ID
            for (let i = 1; i < values.length; i++) {
                if (values[i][0] === telegramId) {
                    // Update the role in column E (index 4)
                    values[i][4] = newRole;
                    values[i][5] = new Date().toISOString(); // Update timestamp
                    // Update the specific cell
                    await this.sheets.spreadsheets.values.update({
                        spreadsheetId: this.spreadsheetId,
                        range: `Sheet1!E${i + 1}:F${i + 1}`,
                        valueInputOption: 'RAW',
                        requestBody: {
                            values: [[newRole, new Date().toISOString()]],
                        },
                    });
                    logger.info(`Updated role in Google Sheets for Telegram ID: ${telegramId} -> ${newRole}`);
                    return true;
                }
            }
            logger.warn(`Telegram ID not found in Google Sheets: ${telegramId}`);
            return false;
        }
        catch (error) {
            logger.error('Failed to update role in Google Sheets:', error);
            return false;
        }
    }
}
// Export singleton instance
export const googleSheetsService = new GoogleSheetsService();
//# sourceMappingURL=googleSheets.js.map