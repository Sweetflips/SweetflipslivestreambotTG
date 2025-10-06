import { PrismaClient } from '@prisma/client';
import { logger } from '../../../telemetry/logger.js';
import { ConflictError, GameStateError } from '../../../utils/errors.js';
import { isAnswerClose } from '../../../utils/regex.js';

export interface TriviaResult {
  game: any;
  totalRounds: number;
  scores: Array<{
    id: string;
    points: number;
    user: {
      id: string;
      kickName?: string;
      telegramUser?: string;
    };
  }>;
}

export interface RoundResult {
  gameId: string;
  roundId: string;
  correctAnswers: Array<{
    id: string;
    user: {
      id: string;
      kickName?: string;
      telegramUser?: string;
    };
  }>;
}

export class TriviaService {
  constructor(private prisma: PrismaClient) {}

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
        type: 'TRIVIA',
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    logger.info('Trivia game started', { gameId: game.id });
    return game;
  }

  async createRound(question: string, answer: string) {
    const activeGame = await this.getActiveGame();

    const round = await this.prisma.triviaRound.create({
      data: {
        gameId: activeGame.id,
        question,
        answer,
        status: 'OPEN',
      },
    });

    logger.info('Trivia round created', { gameId: activeGame.id, roundId: round.id });
    return round;
  }

  async submitAnswer(roundId: string, userId: string, answer: string) {
    const round = await this.prisma.triviaRound.findUnique({
      where: { id: roundId },
      include: {
        answers: {
          where: { userId },
        },
      },
    });

    if (!round) {
      throw new GameStateError('Round not found');
    }

    if (round.status !== 'OPEN') {
      throw new GameStateError('Round is not accepting answers');
    }

    // Check if user already answered
    if (round.answers.length > 0) {
      throw new ConflictError('You have already answered this question');
    }

    // Check if answer is correct
    const isCorrect = isAnswerClose(answer, round.answer);

    const triviaAnswer = await this.prisma.triviaAnswer.create({
      data: {
        roundId,
        userId,
        answer,
        isCorrect,
      },
    });

    logger.info('Trivia answer submitted', {
      roundId,
      userId,
      isCorrect,
    });

    return triviaAnswer;
  }

  async lockRound(): Promise<RoundResult> {
    const activeGame = await this.getActiveGame();

    // Find the current open round
    const openRound = await this.prisma.triviaRound.findFirst({
      where: {
        gameId: activeGame.id,
        status: 'OPEN',
      },
      include: {
        answers: {
          where: { isCorrect: true },
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

    if (!openRound) {
      throw new GameStateError('No open round found');
    }

    // Lock the round
    await this.prisma.triviaRound.update({
      where: { id: openRound.id },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
      },
    });

    // Award points to correct answers
    for (const answer of openRound.answers) {
      await this.prisma.score.upsert({
        where: {
          gameId_userId: {
            gameId: activeGame.id,
            userId: answer.userId,
          },
        },
        update: {
          points: {
            increment: 1,
          },
        },
        create: {
          gameId: activeGame.id,
          userId: answer.userId,
          points: 1,
        },
      });
    }

    logger.info('Trivia round locked', {
      gameId: activeGame.id,
      roundId: openRound.id,
      correctAnswers: openRound.answers.length,
    });

    return {
      gameId: activeGame.id,
      roundId: openRound.id,
      correctAnswers: openRound.answers,
    };
  }

  async stopGame(): Promise<TriviaResult> {
    const activeGame = await this.getActiveGame();

    // Get final scores
    const scores = await this.prisma.score.findMany({
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
        points: 'desc',
      },
    });

    // Count total rounds
    const totalRounds = await this.prisma.triviaRound.count({
      where: { gameId: activeGame.id },
    });

    // Update game status
    const game = await this.prisma.game.update({
      where: { id: activeGame.id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    logger.info('Trivia game stopped', {
      gameId: game.id,
      totalRounds,
      scoresCount: scores.length,
    });

    return {
      game,
      totalRounds,
      scores,
    };
  }

  async getActiveGame() {
    const game = await this.prisma.game.findFirst({
      where: {
        type: 'TRIVIA',
        status: {
          in: ['RUNNING', 'OPENING'],
        },
      },
    });

    if (!game) {
      throw new GameStateError('No active trivia game');
    }

    return game;
  }

  async getCurrentOpenRound(gameId: string) {
    const round = await this.prisma.triviaRound.findFirst({
      where: {
        gameId,
        status: 'OPEN',
      },
    });

    return round;
  }

  async getGameState(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        triviaRounds: {
          where: {
            status: 'OPEN',
          },
          include: {
            answers: {
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
        },
        scores: {
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
            points: 'desc',
          },
        },
      },
    });

    if (!game) {
      throw new GameStateError('Game not found');
    }

    return game;
  }
}
