import { GameStatus, GameType, PrismaClient } from '@prisma/client';
import { logger } from '../../../telemetry/logger.js';
import { ConflictError, GameStateError } from '../../../utils/errors.js';
export class BonusService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async startGame() {
        // Check if there's already an active game
        const activeGame = await this.prisma.game.findFirst({
            where: {
                status: {
                    in: ['RUNNING', 'OPENING'],
                },
            },
        });
        if (activeGame) {
            throw new ConflictError('A game is already active');
        }
        const game = await this.prisma.game.create({
            data: {
                type: GameType.BONUS,
                status: GameStatus.RUNNING,
                startedAt: new Date(),
            },
        });
        logger.info('Bonus hunt game started', { gameId: game.id });
        return game;
    }
    async addBonus(bonusName) {
        const activeGame = await this.getActiveGame();
        const bonus = await this.prisma.bonusPayout.create({
            data: {
                gameId: activeGame.id,
                name: bonusName,
                amountX: 0, // Will be set when opened
            },
        });
        logger.info('Bonus added to hunt', { gameId: activeGame.id, bonusName });
        return bonus;
    }
    async recordPayout(bonusName, amountX) {
        const activeGame = await this.getActiveGame();
        // Update the bonus payout
        const payout = await this.prisma.bonusPayout.updateMany({
            where: {
                gameId: activeGame.id,
                name: bonusName,
            },
            data: {
                amountX,
            },
        });
        if (payout.count === 0) {
            throw new GameStateError(`Bonus "${bonusName}" not found`);
        }
        logger.info('Bonus payout recorded', { gameId: activeGame.id, bonusName, amountX });
        return { gameId: activeGame.id, name: bonusName, amountX };
    }
    async closeGame() {
        const activeGame = await this.getActiveGame();
        // Calculate total payout
        const payouts = await this.prisma.bonusPayout.findMany({
            where: { gameId: activeGame.id },
        });
        const totalPayout = payouts.reduce((sum, payout) => sum + payout.amountX, 0);
        // Get all entries with users
        const entries = await this.prisma.bonusEntry.findMany({
            where: { gameId: activeGame.id },
            include: {
                user: {
                    select: {
                        id: true,
                        kickName: true,
                        telegramUser: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'asc',
            },
        });
        // Sort entries by closest guess (absolute difference from total payout)
        const sortedEntries = entries.sort((a, b) => {
            const deltaA = Math.abs(a.guess - totalPayout);
            const deltaB = Math.abs(b.guess - totalPayout);
            return deltaA - deltaB;
        });
        // Update game status
        const game = await this.prisma.game.update({
            where: { id: activeGame.id },
            data: {
                status: GameStatus.COMPLETED,
                endedAt: new Date(),
            },
        });
        logger.info('Bonus hunt game closed', {
            gameId: game.id,
            totalPayout,
            entriesCount: entries.length,
        });
        return {
            game,
            totalPayout,
            entries: sortedEntries,
        };
    }
    async getActiveGame() {
        const game = await this.prisma.game.findFirst({
            where: {
                type: GameType.BONUS,
                status: {
                    in: ['RUNNING', 'OPENING'],
                },
            },
        });
        if (!game) {
            throw new GameStateError('No active bonus hunt game');
        }
        return game;
    }
    async submitGuess(gameId, userId, guess) {
        const game = await this.getActiveGame();
        if (game.id !== gameId) {
            throw new GameStateError('Invalid game ID');
        }
        // Check if user already submitted a guess
        const existingEntry = await this.prisma.bonusEntry.findUnique({
            where: {
                gameId_userId: {
                    gameId,
                    userId,
                },
            },
        });
        if (existingEntry) {
            throw new ConflictError('You have already submitted a guess');
        }
        // Check if this guess value is already taken by another user
        const existingGuess = await this.prisma.bonusEntry.findFirst({
            where: {
                gameId: gameId,
                guess: guess,
            },
        });
        if (existingGuess) {
            console.log(`Duplicate bonus guess detected: User ${userId} tried to guess ${guess} but it's already taken by user ${existingGuess.userId}`);
            throw new ConflictError('This guess has already been submitted by another player. Please choose a different number.');
        }
        // Use transaction to ensure atomicity
        const entry = await this.prisma.$transaction(async (tx) => {
            // Double-check within transaction to prevent race conditions
            const doubleCheck = await tx.bonusEntry.findFirst({
                where: {
                    gameId: gameId,
                    guess: guess,
                },
            });
            if (doubleCheck) {
                throw new ConflictError('This guess has already been submitted by another player. Please choose a different number.');
            }
            // Create new entry
            return await tx.bonusEntry.create({
                data: {
                    gameId,
                    userId,
                    guess,
                },
            });
        });
        logger.info('Bonus hunt guess submitted', {
            gameId,
            userId,
            guess,
        });
        return entry;
    }
    async getGameState(gameId) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: {
                bonusEntries: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                kickName: true,
                                telegramUser: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
                payouts: true,
            },
        });
        if (!game) {
            throw new GameStateError('Game not found');
        }
        const totalPayout = game.payouts.reduce((sum, payout) => sum + payout.amountX, 0);
        return {
            ...game,
            totalPayout,
        };
    }
}
//# sourceMappingURL=bonusService.js.map