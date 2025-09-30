import { BonusEntry, BonusPayout } from '@prisma/client';
export interface BonusGameResult {
    gameId: string;
    totalPayout: number;
    entries: RankedEntry[];
    leaderboard: LeaderboardEntry[];
}
export interface RankedEntry extends BonusEntry {
    user: {
        id: string;
        kickName: string | null;
        telegramUser: string | null;
    };
    delta: number;
    rank: number;
}
export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    guess: number;
    delta: number;
    isWinner: boolean;
}
export declare class BonusGameLogic {
    static calculateFinalPayout(payouts: BonusPayout[]): number;
    static rankEntries(entries: (BonusEntry & {
        user: {
            id: string;
            kickName: string | null;
            telegramUser: string | null;
        };
    })[], finalPayout: number): RankedEntry[];
    static generateLeaderboard(rankedEntries: RankedEntry[], topN?: number): LeaderboardEntry[];
    static calculateWinners(rankedEntries: RankedEntry[], maxWinners?: number): RankedEntry[];
    static validateGuess(guess: number): {
        valid: boolean;
        error?: string;
    };
    static validateBonusName(name: string): {
        valid: boolean;
        error?: string;
    };
    static validatePayoutAmount(amount: number): {
        valid: boolean;
        error?: string;
    };
    static formatGameResult(result: BonusGameResult): string;
    static formatLeaderboard(leaderboard: LeaderboardEntry[]): string;
    static calculatePayoutDistribution(winners: RankedEntry[], totalPrizePool: number): Array<{
        userId: string;
        amount: number;
        percentage: number;
    }>;
}
//# sourceMappingURL=bonusLogic.d.ts.map