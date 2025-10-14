import { PrismaClient } from '@prisma/client';
import { GameType } from '../games/guess/guessService.js';
import { getEnv } from '../../../config/env.js';
import { logger } from '../../../telemetry/logger.js';

const env = getEnv();

export interface PayoutPreview {
  gameId: string;
  winners: Array<{
    id: string;
    cwalletHandle: string;
    amount: number;
    position: number;
  }>;
  tipCommands: string[];
}

export class PayoutService {
  constructor(private prisma: PrismaClient) {}

  async generatePayoutPreview(): Promise<PayoutPreview | null> {
    // Find the most recent completed game
    const game = await this.prisma.game.findFirst({
      where: {
        status: GameStatus.COMPLETED,
        type: GameType.BONUS,
      },
      orderBy: {
        endedAt: 'desc',
      },
      include: {
        bonusEntries: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        payouts: true,
      },
    });

    if (!game) {
      return null;
    }

    // Calculate total payout
    const totalPayout = game.payouts.reduce((sum, payout) => sum + payout.amountX, 0);

    // Sort entries by closest guess
    const sortedEntries = game.bonusEntries.sort((a, b) => {
      const deltaA = Math.abs(a.guess - totalPayout);
      const deltaB = Math.abs(b.guess - totalPayout);
      return deltaA - deltaB;
    });

    // Determine winners (top 3 or top 10% if more than 30 entries)
    const maxWinners = game.bonusEntries.length > 30 ? Math.ceil(game.bonusEntries.length * 0.1) : 3;
    const winners = sortedEntries.slice(0, maxWinners);

    // Generate tip commands
    const tipCommands: string[] = [];
    const baseAmount = 1; // Base tip amount in USDT

    for (let i = 0; i < winners.length; i++) {
      const winner = winners[i];
      const multiplier = winners.length - i; // 3x for 1st, 2x for 2nd, 1x for 3rd
      const amount = baseAmount * multiplier;

      if (winner.user.cwalletHandle) {
        tipCommands.push(`/tip @${winner.user.cwalletHandle} ${amount} USDT`);
      }
    }

    logger.info('Payout preview generated', {
      gameId: game.id,
      winnersCount: winners.length,
      totalPayout,
    });

    return {
      gameId: game.id,
      winners: winners.map((winner, index) => ({
        id: winner.id,
        cwalletHandle: winner.user.cwalletHandle || '',
        amount: baseAmount * (winners.length - index),
        position: index + 1,
      })),
      tipCommands,
    };
  }

  async createAward(userId: string, gameId: string, amount: number, currency: string = 'USDT') {
    const award = await this.prisma.award.create({
      data: {
        userId,
        gameId,
        amount,
        currency,
        status: 'pending',
      },
    });

    logger.info('Award created', {
      awardId: award.id,
      userId,
      gameId,
      amount,
      currency,
    });

    return award;
  }

  async updateAwardStatus(awardId: string, status: string, tipCommand?: string) {
    const award = await this.prisma.award.update({
      where: { id: awardId },
      data: {
        status,
        tipCommand,
        sentAt: status === 'sent' ? new Date() : undefined,
      },
    });

    logger.info('Award status updated', {
      awardId,
      status,
    });

    return award;
  }

  async getAwardsByGame(gameId: string) {
    const awards = await this.prisma.award.findMany({
      where: { gameId },
      include: {
        user: {
          select: {
            id: true,
            kickName: true,
            telegramUser: true,
            cwalletHandle: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return awards;
  }

  async getAwardsByUser(userId: string) {
    const awards = await this.prisma.award.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return awards;
  }
}
