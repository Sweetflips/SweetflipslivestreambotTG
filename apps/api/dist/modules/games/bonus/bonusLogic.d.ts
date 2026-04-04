export interface BonusGameResult {
    gameRoundId: string;
    totalPayout: number;
    entries: RankedEntry[];
    leaderboard: LeaderboardEntry[];
}
export interface RankedEntry {
    id: string;
    value: number;
    user: {
        id: string;
        kickName: string | null;
        telegramUser: string | null;
    };
    delta: number;
    rank: number;
}
export interface LeaderboardEntry {
    id: string;
    value: number;
    user: {
        id: string;
        kickName: string | null;
        telegramUser: string | null;
    };
    delta: number;
    rank: number;
}
export declare function calculateRankings(entries: any[], finalValue: number): RankedEntry[];
export declare function formatLeaderboard(entries: RankedEntry[]): string;
export declare function getWinner(entries: RankedEntry[]): RankedEntry | null;
export declare function formatWinnerMessage(winner: RankedEntry): string;
export declare function calculatePayouts(entries: RankedEntry[], totalPayout: number): Array<{
    userId: string;
    amount: number;
}>;
//# sourceMappingURL=bonusLogic.d.ts.map