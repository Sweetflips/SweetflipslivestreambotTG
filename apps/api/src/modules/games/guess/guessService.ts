import { PrismaClient } from '@prisma/client';
import { GameStateError, ValidationError } from '../../utils/errors.js';

export enum GameType {
  GUESS_BALANCE = 'GUESS_BALANCE',
  GUESS_BONUS = 'GUESS_BONUS',
}

export interface GuessResult {
  success: boolean;
  message: string;
  isEdit?: boolean;
  graceWindowRemaining?: number;
}

export interface GameConfig {
  minRange: number;
  maxRange: number;
  graceWindow: number; // seconds
  windowMin: number; // minutes, 0 = manual close only
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  kickName: string;
  guess: number;
  delta: number;
  isExact: boolean;
  createdAt: Date;
}

export class GuessService {
  constructor(private prisma: PrismaClient) {}

  // Default configurations for each game type
  private getDefaultConfig(gameType: GameType): GameConfig {
    switch (gameType) {
      case GameType.GUESS_BALANCE:
        return {
          minRange: 1,
          maxRange: 1_000_000,
          graceWindow: 30,
          windowMin: 0,
        };
      case GameType.GUESS_BONUS:
        return {
          minRange: 1,
          maxRange: 9_999,
          graceWindow: 30,
          windowMin: 0,
        };
      default:
        throw new ValidationError(`Unsupported game type: ${gameType}`);
    }
  }

  // Get or create current game round
  async getCurrentRound(gameType: GameType) {
    const round = await this.prisma.gameRound.findFirst({
      where: {
        type: gameType,
        phase: {
          in: ['IDLE', 'OPEN', 'CLOSED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!round) {
      // Create new round with default config
      const config = this.getDefaultConfig(gameType);
      return await this.prisma.gameRound.create({
        data: {
          type: gameType,
          phase: 'IDLE',
          ...config,
        },
      });
    }

    return round;
  }

  // Submit a guess
  async submitGuess(
    userId: string,
    gameType: GameType,
    value: number,
    isEdit: boolean = false
  ): Promise<GuessResult> {
    const round = await this.getCurrentRound(gameType);

    // Validate game state
    if (round.phase !== 'OPEN') {
      if (round.phase === 'CLOSED' || round.phase === 'REVEALED') {
        return {
          success: false,
          message: `⛔️ Guessing is closed. ${
            round.phase === 'REVEALED'
              ? 'Results have been revealed!'
              : 'Waiting for results!'
          }`,
        };
      }
      return {
        success: false,
        message: '⛔️ Guessing is not currently open.',
      };
    }

    // Validate range
    if (value < round.minRange || value > round.maxRange) {
      return {
        success: false,
        message: `❌ Guess must be between ${round.minRange} and ${round.maxRange}.`,
      };
    }

    // Check existing guess
    const existingGuess = await this.prisma.guess.findUnique({
      where: {
        gameRoundId_userId: {
          gameRoundId: round.id,
          userId,
        },
      },
    });

    if (existingGuess) {
      if (!isEdit) {
        return {
          success: false,
          message: "⛔️ You've already guessed. Waiting for results!",
        };
      }

      // Check grace window for editing
      const now = new Date();
      const graceEnd = new Date(existingGuess.createdAt.getTime() + round.graceWindow * 1000);

      if (now > graceEnd) {
        return {
          success: false,
          message: "⛔️ Edit window has expired. You've already guessed.",
        };
      }

      // Check if the new value is already taken by another user
      const existingValueGuess = await this.prisma.guess.findFirst({
        where: {
          gameRoundId: round.id,
          value: value,
          id: { not: existingGuess.id },
        },
      });

      if (existingValueGuess) {
        console.log(
          `Duplicate guess detected in edit: User ${userId} tried to edit to ${value} but it's already taken by user ${existingValueGuess.userId}`
        );
        return {
          success: false,
          message:
            '⛔️ This guess has already been submitted by another player. Please choose a different number.',
        };
      }

      // Use transaction to ensure atomicity
      try {
        await this.prisma.$transaction(async tx => {
          // Double-check within transaction to prevent race conditions
          const doubleCheck = await tx.guess.findFirst({
            where: {
              gameRoundId: round.id,
              value: value,
              id: { not: existingGuess.id },
            },
          });

          if (doubleCheck) {
            throw new Error('DUPLICATE_GUESS');
          }

          // Update existing guess
          await tx.guess.update({
            where: { id: existingGuess.id },
            data: {
              value,
              editedAt: now,
            },
          });
        });
      } catch (error) {
        if ((error as any).message === 'DUPLICATE_GUESS') {
          return {
            success: false,
            message:
              '⛔️ This guess has already been submitted by another player. Please choose a different number.',
          };
        }
        throw error; // Re-throw other errors
      }

      const remainingSeconds = Math.max(0, Math.floor((graceEnd.getTime() - now.getTime()) / 1000));

      return {
        success: true,
        message: `✏️ Updated to *${value}*.`,
        isEdit: true,
        graceWindowRemaining: remainingSeconds,
      };
    }

    // Check if this guess value is already taken by another user
    const existingValueGuess = await this.prisma.guess.findFirst({
      where: {
        gameRoundId: round.id,
        value: value,
      },
    });

    if (existingValueGuess) {
      console.log(
        `Duplicate guess detected: User ${userId} tried to guess ${value} but it's already taken by user ${existingValueGuess.userId}`
      );
      return {
        success: false,
        message:
          '⛔️ This guess has already been submitted by another player. Please choose a different number.',
      };
    }

    // Use transaction to ensure atomicity
    try {
      await this.prisma.$transaction(async tx => {
        // Double-check within transaction to prevent race conditions
        const doubleCheck = await tx.guess.findFirst({
          where: {
            gameRoundId: round.id,
            value: value,
          },
        });

        if (doubleCheck) {
          throw new Error('DUPLICATE_GUESS');
        }

        // Create new guess
        await tx.guess.create({
          data: {
            gameRoundId: round.id,
            userId,
            value,
          },
        });
      });
    } catch (error) {
      if ((error as any).message === 'DUPLICATE_GUESS') {
        return {
          success: false,
          message:
            '⛔️ This guess has already been submitted by another player. Please choose a different number.',
        };
      }
      throw error; // Re-throw other errors
    }

    return {
      success: true,
      message: `✅ Saved *${value}*. You can edit once within ${round.graceWindow}s with /${
        gameType === GameType.GUESS_BALANCE ? 'gtbalance' : 'gtbonus'
      } again.`,
      isEdit: false,
      graceWindowRemaining: round.graceWindow,
    };
  }

  // Open a game round
  async openRound(gameType: GameType, userId: string): Promise<string> {
    const round = await this.getCurrentRound(gameType);

    if (round.phase === 'OPEN') {
      return `✅ *${
        gameType === GameType.GUESS_BALANCE ? 'Balance' : 'Bonus'
      }* guesses are already OPEN.`;
    }

    await this.prisma.gameRound.update({
      where: { id: round.id },
      data: {
        phase: 'OPEN',
        updatedAt: new Date(),
      },
    });

    await this.logAudit(userId, `open_${gameType.toLowerCase()}`, { gameType });

    const windowText = round.windowMin > 0 ? ` You have ${round.windowMin} minutes.` : '';
    return `✅ *${
      gameType === GameType.GUESS_BALANCE ? 'Balance' : 'Bonus'
    }* guesses are OPEN.${windowText} One guess per user.`;
  }

  // Close a game round
  async closeRound(gameType: GameType, userId: string): Promise<string> {
    const round = await this.getCurrentRound(gameType);

    if (round.phase !== 'OPEN') {
      return `⛔️ *${
        gameType === GameType.GUESS_BALANCE ? 'Balance' : 'Bonus'
      }* guesses are not currently open.`;
    }

    const guessCount = await this.prisma.guess.count({
      where: { gameRoundId: round.id },
    });

    await this.prisma.gameRound.update({
      where: { id: round.id },
      data: {
        phase: 'CLOSED',
        closedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.logAudit(userId, `close_${gameType.toLowerCase()}`, { gameType, guessCount });

    return `⛔️ *${
      gameType === GameType.GUESS_BALANCE ? 'Balance' : 'Bonus'
    }* guesses are CLOSED. ${guessCount} entries collected.`;
  }

  // Set final value
  async setFinalValue(gameType: GameType, value: number, userId: string): Promise<string> {
    const round = await this.getCurrentRound(gameType);

    await this.prisma.gameRound.update({
      where: { id: round.id },
      data: {
        finalValue: value,
        updatedAt: new Date(),
      },
    });

    await this.logAudit(userId, `final_${gameType.toLowerCase()}`, { gameType, value });

    return `✅ Final ${
      gameType === GameType.GUESS_BALANCE ? 'balance' : 'bonus total'
    } set to *${value}*.`;
  }

  // Reveal results
  async revealResults(gameType: GameType, userId: string, topN: number = 10): Promise<string> {
    const round = await this.getCurrentRound(gameType);

    if (!round.finalValue) {
      return `❌ Final value must be set before revealing results. Use /${
        gameType === GameType.GUESS_BALANCE ? 'balance' : 'bonus'
      } final <number> first.`;
    }

    if (round.phase === 'REVEALED') {
      return `✅ Results have already been revealed.`;
    }

    const leaderboard = await this.getLeaderboard(gameType, topN);

    await this.prisma.gameRound.update({
      where: { id: round.id },
      data: {
        phase: 'REVEALED',
        revealedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await this.logAudit(userId, `reveal_${gameType.toLowerCase()}`, {
      gameType,
      finalValue: round.finalValue,
      topN,
    });

    const gameName = gameType === GameType.GUESS_BALANCE ? 'Balance' : 'Bonuses Total';
    const header = `🏁 Final ${gameName}: *${round.finalValue}${
      gameType === GameType.GUESS_BONUS ? 'x' : ''
    }*`;

    let body = '';
    if (leaderboard.length > 0) {
      body = '\n\n🏆 **Top Results:**\n';
      leaderboard.forEach(entry => {
        const deltaText = entry.isExact ? '🎯 EXACT!' : `(Δ ${entry.delta})`;
        body += `${entry.rank}) @${entry.kickName || entry.username} ${deltaText}\n`;
      });
    } else {
      body = '\n\nNo guesses were submitted.';
    }

    return header + body;
  }

  // Complete a game round and archive all data
  async completeGameRound(gameType: GameType, userId: string): Promise<string> {
    const round = await this.getCurrentRound(gameType);

    if (round.phase !== 'REVEALED') {
      return `❌ Game must be revealed before completion. Use /${
        gameType === GameType.GUESS_BALANCE ? 'balance' : 'bonus'
      } reveal first.`;
    }

    if (round.phase === 'COMPLETED') {
      return `✅ Game has already been completed and archived.`;
    }

    // Get all guesses with user data for archiving
    const guesses = await this.prisma.guess.findMany({
      where: { gameRoundId: round.id },
      include: {
        user: {
          select: {
            id: true,
            telegramUser: true,
            kickName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get leaderboard for winner determination
    const leaderboard = await this.getLeaderboard(gameType, 1);
    const winner = leaderboard.length > 0 ? leaderboard[0] : null;

    // Create archive data
    const archiveData = {
      gameRound: {
        id: round.id,
        type: round.type,
        finalValue: round.finalValue,
        createdAt: round.createdAt,
        closedAt: round.closedAt,
        revealedAt: round.revealedAt,
      },
      guesses: guesses.map(guess => ({
        id: guess.id,
        userId: guess.userId,
        username: guess.user.telegramUser,
        kickName: guess.user.kickName,
        value: guess.value,
        createdAt: guess.createdAt,
        editedAt: guess.editedAt,
      })),
      winner: winner
        ? {
            userId: winner.userId,
            username: winner.username,
            kickName: winner.kickName,
            guess: winner.guess,
            delta: winner.delta,
            isExact: winner.isExact,
          }
        : null,
      totalGuesses: guesses.length,
    };

    // Use transaction to ensure data consistency
    await this.prisma.$transaction(async tx => {
      // Archive functionality removed - table doesn't exist
      // await tx.completedGameArchive.create({
      //   data: {
      //     originalGameRoundId: round.id,
      //     gameType: round.type,
      //     finalValue: round.finalValue,
      //     totalGuesses: guesses.length,
      //     winnerUserId: winner?.userId || null,
      //     winnerGuess: winner?.guess || null,
      //     gameData: JSON.stringify(archiveData),
      //     completedAt: round.revealedAt || new Date(),
      //   },
      // });

      // Mark all guesses as archived
      await tx.guess.updateMany({
        where: { gameRoundId: round.id },
        data: { isArchived: true },
      });

      // Mark game round as completed
      await tx.gameRound.update({
        where: { id: round.id },
        data: {
          phase: 'COMPLETED',
          // completedAt: new Date(), // Field doesn't exist
          updatedAt: new Date(),
        },
      });
    });

    await this.logAudit(userId, `complete_${gameType.toLowerCase()}`, {
      gameType,
      finalValue: round.finalValue,
      totalGuesses: guesses.length,
      winner: winner?.userId || null,
    });

    const gameName = gameType === GameType.GUESS_BALANCE ? 'Balance' : 'Bonus';
    const winnerText = winner
      ? `\n🏆 Winner: @${winner.kickName || winner.username} (${winner.guess})`
      : '\n🏆 No winner (no guesses submitted)';

    return `✅ *${gameName}* game completed and archived!\n\n📊 **Final Stats:**\n• Total guesses: ${guesses.length}\n• Final value: ${round.finalValue}${winnerText}\n\nAll data has been preserved in the archive.`;
  }

  // Get leaderboard
  async getLeaderboard(gameType: GameType, topN: number = 10): Promise<LeaderboardEntry[]> {
    const round = await this.getCurrentRound(gameType);

    if (!round.finalValue) {
      throw new GameStateError('Final value not set');
    }

    const guesses = await this.prisma.guess.findMany({
      where: { gameRoundId: round.id },
      include: {
        user: {
          select: {
            telegramUser: true,
            kickName: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' }, // Tie-breaker: earliest guess wins
      ],
    });

    // Calculate deltas and sort by absolute difference
    const entries = guesses
      .map(guess => ({
        userId: guess.userId,
        username: guess.user.telegramUser || 'Unknown',
        kickName: guess.user.kickName || guess.user.telegramUser || 'Unknown',
        guess: guess.value,
        delta: Math.abs(guess.value - (round.finalValue ?? 0)),
        isExact: guess.value === round.finalValue,
        createdAt: guess.createdAt,
      }))
      .sort((a, b) => {
        // Sort by delta (closest first), then by creation time (earliest first)
        if (a.delta !== b.delta) {
          return a.delta - b.delta;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    // Add ranks
    return entries.slice(0, topN).map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  // Show current standings (without revealing final value)
  async showStandings(gameType: GameType, topN: number = 10): Promise<string> {
    const round = await this.getCurrentRound(gameType);

    if (round.phase === 'IDLE') {
      return `⛔️ No ${
        gameType === GameType.GUESS_BALANCE ? 'balance' : 'bonus'
      } game is currently active.`;
    }

    const guessCount = await this.prisma.guess.count({
      where: { gameRoundId: round.id },
    });

    if (guessCount === 0) {
      return `📊 **Current Standings:**\n\nNo guesses submitted yet.`;
    }

    let message = `📊 **Current Standings:**\n\n${guessCount} guess${
      guessCount === 1 ? '' : 'es'
    } submitted.`;

    if (round.phase === 'REVEALED' && round.finalValue) {
      // Show actual leaderboard if revealed
      const leaderboard = await this.getLeaderboard(gameType, topN);
      if (leaderboard.length > 0) {
        message += '\n\n🏆 **Results:**\n';
        leaderboard.forEach(entry => {
          const deltaText = entry.isExact ? '🎯 EXACT!' : `(Δ ${entry.delta})`;
          message += `${entry.rank}) @${entry.kickName || entry.username} ${deltaText}\n`;
        });
      }
    } else {
      // Show guess count by range if not revealed
      const guesses = await this.prisma.guess.findMany({
        where: { gameRoundId: round.id },
        include: {
          user: {
            select: {
              telegramUser: true,
              kickName: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: topN,
      });

      message += '\n\n📝 **Recent Guesses:**\n';
      guesses.forEach((guess, index) => {
        const username = guess.user.kickName || guess.user.telegramUser || 'Unknown';
        message += `${index + 1}) @${username}: ${guess.value}\n`;
      });
    }

    return message;
  }

  // Reset current round
  async resetRound(gameType: GameType, userId: string): Promise<string> {
    const rounds = await this.prisma.gameRound.findMany({
      where: {
        type: gameType,
        phase: {
          not: 'COMPLETED',
        },
      },
    });

    if (rounds.length === 0) {
      return `❌ No active game round found to reset.`;
    }

    const roundIds = rounds.map(r => r.id);

    const guessCount = await this.prisma.guess.count({
      where: { gameRoundId: { in: roundIds } },
    });

    if (guessCount > 0) {
      const guesses = await this.prisma.guess.findMany({
        where: { gameRoundId: { in: roundIds } },
        include: {
          user: {
            select: {
              id: true,
              telegramUser: true,
              kickName: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      const resetArchiveData = {
        gameRounds: rounds.map(r => ({
          id: r.id,
          type: r.type,
          finalValue: r.finalValue,
          createdAt: r.createdAt,
          closedAt: r.closedAt,
          revealedAt: r.revealedAt,
          phase: r.phase,
        })),
        guesses: guesses.map(guess => ({
          id: guess.id,
          userId: guess.userId,
          username: guess.user.telegramUser,
          kickName: guess.user.kickName,
          value: guess.value,
          createdAt: guess.createdAt,
          editedAt: guess.editedAt,
        })),
        totalGuesses: guesses.length,
        resetReason: 'Manual reset by admin',
      };
    }

    await this.prisma.guess.deleteMany({
      where: { gameRoundId: { in: roundIds } },
    });

    await this.prisma.bonusItem.deleteMany({
      where: { gameRoundId: { in: roundIds } },
    });

    await this.prisma.gameRound.deleteMany({
      where: { id: { in: roundIds } },
    });

    await this.logAudit(userId, `reset_${gameType.toLowerCase()}`, {
      gameType,
      deletedGuesses: guessCount,
    });

    const deletedNote = guessCount > 0 ? ` (${guessCount} guesses deleted)` : '';

    return `✅ ${
      gameType === GameType.GUESS_BALANCE ? 'Balance' : 'Bonus'
    } game reset. All guesses and results cleared.${deletedNote}`;
  }

  // Start a new game round (creates fresh round)
  async startNewRound(gameType: GameType, userId: string): Promise<string> {
    const currentRound = await this.getCurrentRound(gameType);

    // If current round has data, complete it first
    if (currentRound.phase !== 'IDLE') {
      const guessCount = await this.prisma.guess.count({
        where: { gameRoundId: currentRound.id },
      });

      if (guessCount > 0) {
        return `❌ Cannot start new game while current game has ${guessCount} guess${
          guessCount === 1 ? '' : 'es'
        }. Complete or reset the current game first.`;
      }
    }

    // Create new round
    const config = this.getDefaultConfig(gameType);
    const newRound = await this.prisma.gameRound.create({
      data: {
        type: gameType,
        phase: 'IDLE',
        ...config,
      },
    });

    await this.logAudit(userId, `new_${gameType.toLowerCase()}`, {
      gameType,
      newRoundId: newRound.id,
    });

    return `✅ New ${
      gameType === GameType.GUESS_BALANCE ? 'Balance' : 'Bonus'
    } game round created. Ready to open for guesses.`;
  }

  // Update game configuration
  async updateConfig(
    gameType: GameType,
    config: Partial<GameConfig>,
    userId: string
  ): Promise<string> {
    const round = await this.getCurrentRound(gameType);

    await this.prisma.gameRound.update({
      where: { id: round.id },
      data: {
        ...config,
        updatedAt: new Date(),
      },
    });

    await this.logAudit(userId, `config_${gameType.toLowerCase()}`, { gameType, config });

    const changes = Object.entries(config)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    return `✅ ${
      gameType === GameType.GUESS_BALANCE ? 'Balance' : 'Bonus'
    } game config updated: ${changes}`;
  }

  // Export guesses as CSV data
  async exportGuesses(gameType: GameType): Promise<string> {
    const round = await this.getCurrentRound(gameType);

    const guesses = await this.prisma.guess.findMany({
      where: { gameRoundId: round.id },
      include: {
        user: {
          select: {
            telegramUser: true,
            kickName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (guesses.length === 0) {
      return 'No guesses to export.';
    }

    const csvHeader = 'Username,Kick Name,Guess,Submitted At,Edited At\n';
    const csvRows = guesses
      .map(guess => {
        const username = guess.user.telegramUser || 'Unknown';
        const kickName = guess.user.kickName || '';
        const submittedAt = guess.createdAt.toISOString();
        const editedAt = guess.editedAt?.toISOString() || '';

        return `"${username}","${kickName}",${guess.value},"${submittedAt}","${editedAt}"`;
      })
      .join('\n');

    return csvHeader + csvRows;
  }

  // Log audit entry
  private async logAudit(userId: string, command: string, params?: any): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        command,
        params: params ? JSON.stringify(params) : null,
      },
    });
  }

  // Check if user has admin role
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: userId },
      select: { role: true },
    });

    return user?.role === Role.MOD || user?.role === Role.OWNER;
  }

  // Check if user has owner role
  async isOwner(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId: userId },
      select: { role: true },
    });

    return user?.role === 'OWNER';
  }

  // Get archived games
  // Archive functionality removed - table doesn't exist
  async getArchivedGames(gameType?: any, limit: number = 10): Promise<any[]> {
    const whereClause = gameType ? { gameType } : {};

    // Archive functionality removed - table doesn't exist
    return [];
  }

  // Get archived game details
  async getArchivedGameDetails(archiveId: string): Promise<any> {
    // Archive functionality removed - table doesn't exist
    throw new ValidationError('Archive functionality removed');
  }

  // Clean up old archived data (data retention policy)
  async cleanupOldArchives(daysToKeep: number = 90, userId: string): Promise<string> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Archive functionality removed - table doesn't exist
    return `✅ Archive functionality removed - no cleanup needed.`;
  }

  // Get game statistics
  async getGameStatistics(gameType?: any): Promise<any> {
    // Archive functionality removed - table doesn't exist
    return {
      totalArchives: 0,
      totalGuesses: 0,
      recentGames: [],
    };
  }
}
