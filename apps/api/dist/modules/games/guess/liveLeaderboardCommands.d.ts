import { PrismaClient } from '@prisma/client';
import { Context } from 'telegraf';
import { LiveBalanceService } from '../../services/liveBalanceService';
export declare class LiveLeaderboardCommands {
    private prisma;
    private liveBalanceService;
    constructor(prisma: PrismaClient, liveBalanceService: LiveBalanceService);
    /**
     * Show live leaderboard for balance guessing game
     */
    showLiveLeaderboard(ctx: Context, showTop?: number): Promise<void>;
    /**
     * Show live balance only (for admins)
     */
    showLiveBalance(ctx: Context): Promise<void>;
    /**
     * Get current game guesses from database
     */
    private getCurrentGameGuesses;
    /**
     * Format live leaderboard with current balance
     */
    private formatLiveLeaderboard;
}
//# sourceMappingURL=liveLeaderboardCommands.d.ts.map