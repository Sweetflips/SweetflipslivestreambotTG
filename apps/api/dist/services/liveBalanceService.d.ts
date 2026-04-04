export interface LiveBalanceData {
    currentBalance: number;
    lastUpdated: Date;
    source: string;
}
export interface LeaderboardEntry {
    rank: number;
    telegramUsername: string;
    kickUsername: string;
    guess: number;
    difference: number;
    isExact: boolean;
}
export declare class LiveBalanceService {
    private bearerToken;
    private balanceApiUrl;
    private lastBalance;
    private lastUpdate;
    constructor(bearerToken: string, balanceApiUrl?: string);
    /**
     * Fetch current live balance from external API
     */
    fetchCurrentBalance(): Promise<LiveBalanceData>;
    /**
     * Extract balance value from API response
     * This method should be customized based on the actual API response structure
     */
    private extractBalanceFromResponse;
    /**
     * Get cached balance if available and not too old
     */
    getCachedBalance(maxAgeMinutes?: number): LiveBalanceData | null;
    /**
     * Calculate leaderboard entries based on current balance and user guesses
     */
    calculateLeaderboard(currentBalance: number, userGuesses: Array<{
        telegramUsername: string;
        kickUsername: string;
        guess: number;
    }>): LeaderboardEntry[];
    /**
     * Format leaderboard for display
     */
    formatLeaderboard(entries: LeaderboardEntry[], showTop?: number): string;
}
//# sourceMappingURL=liveBalanceService.d.ts.map