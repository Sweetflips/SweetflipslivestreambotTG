import { PrismaClient } from '@prisma/client';
import { logger } from '../../../telemetry/logger.js';
import { ConflictError, GameStateError } from '../../../utils/errors.js';

export interface BonusHuntResult {
  gameRound: any;
  totalPayout: number;
  entries: Array<{
    id: string;
    value: number;
    user: {
      id: string;
      kickName?: string;
      telegramUser?: string;
    };
  }>;
}

export class BonusService {
  constructor(private prisma: PrismaClient) {}

  async startGame() {
    // Check if there's already an active game round
    const activeGameRound = await this.prisma.gameRound.findFirst({
      where: {
        type: 'BONUS',
        phase: {
          in: ['OPEN', 'IDLE'],
        },
      },
    });

    if (activeGameRound) {
      throw new ConflictError('A bonus game is already active');
    }

    // Create new bonus game round
    const gameRound = await this.prisma.gameRound.create({
      data: {
        type: 'BONUS',
        phase: 'OPEN',
        minRange: 1,
        maxRange: 1000000,
      },
    });

    logger.info(`Started new bonus game: ${gameRound.id}`);
    return gameRound;
  }

  async closeGame(gameRoundId: string) {
    const gameRound = await this.prisma.gameRound.findUnique({
      where: { id: gameRoundId },
    });

    if (!gameRound) {
      throw new GameStateError('Game not found');
    }

    if (gameRound.phase !== 'OPEN') {
      throw new GameStateError('Game is not open');
    }

    const updatedGameRound = await this.prisma.gameRound.update({
      where: { id: gameRoundId },
      data: {
        phase: 'CLOSED',
        closedAt: new Date(),
      },
    });

    logger.info(`Closed bonus game: ${gameRoundId}`);
    return updatedGameRound;
  }

  async revealGame(gameRoundId: string, finalValue: number) {
    const gameRound = await this.prisma.gameRound.findUnique({
      where: { id: gameRoundId },
    });

    if (!gameRound) {
      throw new GameStateError('Game not found');
    }

    if (gameRound.phase !== 'CLOSED') {
      throw new GameStateError('Game must be closed before revealing');
    }

    const updatedGameRound = await this.prisma.gameRound.update({
      where: { id: gameRoundId },
      data: {
        phase: 'REVEALED',
        finalValue,
        revealedAt: new Date(),
      },
    });

    logger.info(`Revealed bonus game: ${gameRoundId} with final value: ${finalValue}`);
    return updatedGameRound;
  }

  async submitGuess(gameRoundId: string, userId: string, guess: number) {
    // Check if game is open
    const gameRound = await this.prisma.gameRound.findUnique({
      where: { id: gameRoundId },
    });

    if (!gameRound) {
      throw new GameStateError('Game not found');
    }

    if (gameRound.phase !== 'OPEN') {
      throw new GameStateError('Game is not accepting guesses');
    }

    // Check if user already submitted a guess
    const existingGuess = await this.prisma.guess.findFirst({
      where: {
        gameRoundId,
        userId,
      },
    });

    if (existingGuess) {
      throw new ConflictError('You have already submitted a guess for this game');
    }

    // Create the guess
    const guessEntry = await this.prisma.guess.create({
      data: {
        gameRoundId,
        userId,
        value: guess,
      },
      include: {
        user: {
          select: {
            id: true,
            kickName: true,
            telegramUser: true,
          },
        },
      },
    });

    logger.info(`User ${userId} submitted guess ${guess} for game ${gameRoundId}`);
    return guessEntry;
  }

  async getGameResults(gameRoundId: string): Promise<BonusHuntResult> {
    const gameRound = await this.prisma.gameRound.findUnique({
      where: { id: gameRoundId },
      include: {
        guesses: {
          include: {
            user: {
              select: {
                id: true,
                kickName: true,
                telegramUser: true,
              },
            },
          },
        },
        bonusItems: true,
      },
    });

    if (!gameRound) {
      throw new GameStateError('Game not found');
    }

    const totalPayout = gameRound.bonusItems.reduce((sum, item) => sum + (item.payoutX || 0), 0);

    return {
      gameRound,
      totalPayout,
      entries: gameRound.guesses.map(guess => ({
        id: guess.id,
        value: guess.value,
        user: {
          id: guess.user.id,
          kickName: guess.user.kickName ?? undefined,
          telegramUser: guess.user.telegramUser ?? undefined,
        },
      })),
    };
  }

  async getCurrentGame() {
    return await this.prisma.gameRound.findFirst({
      where: {
        type: 'BONUS',
        phase: 'OPEN',
      },
    });
  }

  async getLeaderboard(gameRoundId: string) {
    const gameRound = await this.prisma.gameRound.findUnique({
      where: { id: gameRoundId },
      include: {
        guesses: {
          include: {
            user: {
              select: {
                id: true,
                kickName: true,
                telegramUser: true,
              },
            },
          },
        },
      },
    });

    if (!gameRound || !gameRound.finalValue) {
      return [];
    }

    // Calculate distances from final value
    const entries = gameRound.guesses.map(guess => ({
      ...guess,
      distance: Math.abs(guess.value - gameRound.finalValue!),
    }));

    // Sort by distance (closest first)
    return entries.sort((a, b) => a.distance - b.distance);
  }
}