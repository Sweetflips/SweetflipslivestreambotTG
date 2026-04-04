import { PrismaClient } from '@prisma/client';
import { Context } from 'telegraf';
import { LeaderboardEntry, LiveBalanceService } from '../../services/liveBalanceService';
import { logger } from '../../telemetry/logger';
export class LiveLeaderboardCommands {
    prisma;
    liveBalanceService;
    constructor(prisma, liveBalanceService) {
        this.prisma = prisma;
        this.liveBalanceService = liveBalanceService;
    }
    /**
     * Show live leaderboard for balance guessing game
     */
    async showLiveLeaderboard(ctx, showTop = 10) {
        try {
            // Check if user has permission (anyone can view leaderboard)
            const userId = ctx.from?.id?.toString();
            if (!userId) {
                await ctx.reply('❌ Unable to identify user.');
                return;
            }
            // Get current live balance
            let currentBalance;
            try {
                const balanceData = await this.liveBalanceService.fetchCurrentBalance();
                currentBalance = balanceData.currentBalance;
            }
            catch (error) {
                logger.error('Failed to fetch live balance:', error);
                await ctx.reply('❌ Unable to fetch current balance. Please try again later.');
                return;
            }
            // Get all user guesses for the current balance game
            const guesses = await this.getCurrentGameGuesses();
            if (guesses.length === 0) {
                await ctx.reply(`📊 **Current Balance: ${currentBalance.toLocaleString()}**\n\n` +
                    `No guesses recorded yet. Use /guess balance <number> to make a guess!`);
                return;
            }
            // Calculate leaderboard
            const leaderboard = this.liveBalanceService.calculateLeaderboard(currentBalance, guesses);
            // Format and send leaderboard
            const leaderboardText = this.formatLiveLeaderboard(currentBalance, leaderboard, showTop);
            await ctx.reply(leaderboardText);
            logger.info(`Live leaderboard displayed for user ${userId}, showing top ${showTop}`);
        }
        catch (error) {
            logger.error('Error showing live leaderboard:', error);
            await ctx.reply('❌ Error displaying leaderboard. Please try again.');
        }
    }
    /**
     * Show live balance only (for admins)
     */
    async showLiveBalance(ctx) {
        try {
            const userId = ctx.from?.id?.toString();
            if (!userId) {
                await ctx.reply('❌ Unable to identify user.');
                return;
            }
            // Check if user is admin
            const user = await this.prisma.user.findUnique({
                where: { telegramId: userId },
            });
            if (!user || !['MOD', 'OWNER'].includes(user.role)) {
                await ctx.reply('⛔️ Mods only.');
                return;
            }
            // Get current live balance
            const balanceData = await this.liveBalanceService.fetchCurrentBalance();
            const message = `💰 **Live Balance Update**\n\n` +
                `Current Balance: **${balanceData.currentBalance.toLocaleString()}**\n` +
                `Last Updated: ${balanceData.lastUpdated.toLocaleString()}\n` +
                `Source: ${balanceData.source}`;
            await ctx.reply(message);
            logger.info(`Live balance displayed for admin ${userId}`);
        }
        catch (error) {
            logger.error('Error showing live balance:', error);
            await ctx.reply('❌ Error fetching live balance. Please try again.');
        }
    }
    /**
     * Get current game guesses from database
     */
    async getCurrentGameGuesses() {
        // Get the most recent open or closed balance game
        const currentGame = await this.prisma.gameRound.findFirst({
            where: {
                type: 'GUESS_BALANCE',
                status: { in: ['OPEN', 'CLOSED'] },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!currentGame) {
            return [];
        }
        // Get all guesses for this game
        const guesses = await this.prisma.guess.findMany({
            where: { gameRoundId: currentGame.id },
            include: {
                user: true,
            },
        });
        return guesses.map(guess => ({
            telegramUsername: guess.user.telegramUser || 'Unknown',
            kickUsername: guess.user.kickName || '',
            guess: guess.valueInt,
        }));
    }
    /**
     * Format live leaderboard with current balance
     */
    formatLiveLeaderboard(currentBalance, leaderboard, showTop) {
        let message = `💰 **Live Balance: ${currentBalance.toLocaleString()}**\n\n`;
        if (leaderboard.length === 0) {
            message += '📊 No guesses recorded yet.';
            return message;
        }
        message += '🏆 **Leaderboard**\n\n';
        const topEntries = leaderboard.slice(0, showTop);
        topEntries.forEach(entry => {
            const medal = entry.rank === 1
                ? '🥇'
                : entry.rank === 2
                    ? '🥈'
                    : entry.rank === 3
                        ? '🥉'
                        : `${entry.rank}.`;
            const exact = entry.isExact ? ' 🎯' : '';
            const displayName = entry.kickUsername ? `@${entry.kickUsername}` : entry.telegramUsername;
            const difference = entry.difference === 0 ? 'EXACT!' : `(${entry.difference.toLocaleString()} off)`;
            message += `${medal} ${displayName} - ${entry.guess.toLocaleString()} ${difference}${exact}\n`;
        });
        if (leaderboard.length > showTop) {
            message += `\n... and ${leaderboard.length - showTop} more`;
        }
        // Add live update indicator
        message += `\n\n🔄 *Live updates every 30 seconds*`;
        return message;
    }
}
//# sourceMappingURL=liveLeaderboardCommands.js.map