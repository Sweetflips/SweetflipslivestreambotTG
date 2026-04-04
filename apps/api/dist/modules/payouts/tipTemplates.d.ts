import { Award, User } from '@prisma/client';
export interface PayoutPreview {
    gameId: string;
    winners: PayoutWinner[];
    tipCommands: string[];
    totalAmount: number;
    currency: string;
}
export interface PayoutWinner {
    userId: string;
    username: string;
    amount: string;
    cwalletHandle?: string;
    rank: number;
}
export declare class TipTemplateGenerator {
    static generatePayoutPreview(awards: (Award & {
        user: User;
    })[]): PayoutPreview;
    static generateTipCommands(winners: PayoutWinner[]): string[];
    static generateSummaryMessage(preview: PayoutPreview): string;
    static generateTreasurerInstructions(preview: PayoutPreview): string;
    static generatePayoutGroupMessage(preview: PayoutPreview): string;
    private static calculateTotalAmount;
    static formatAmount(amount: string): string;
    static validateCwalletHandle(handle: string): boolean;
    static sanitizeUsername(username: string): string;
    static generateBackupInstructions(preview: PayoutPreview): string;
}
//# sourceMappingURL=tipTemplates.d.ts.map