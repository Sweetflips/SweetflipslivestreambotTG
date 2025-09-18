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

export class BonusGameLogic {
  static calculateFinalPayout(payouts: BonusPayout[]): number {
    return payouts.reduce((total, payout) => total + payout.amountX, 0);
  }

  static rankEntries(entries: (BonusEntry & { user: { id: string; kickName: string | null; telegramUser: string | null } })[], finalPayout: number): RankedEntry[] {
    // Calculate deltas and sort by delta (ascending), then by creation time (ascending)
    const rankedEntries = entries
      .map(entry => ({
        ...entry,
        delta: Math.abs(entry.guess - finalPayout),
      }))
      .sort((a, b) => {
        // Primary sort: by delta (closest wins)
        if (a.delta !== b.delta) {
          return a.delta - b.delta;
        }
        // Secondary sort: by creation time (earliest wins in case of tie)
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return rankedEntries;
  }

  static generateLeaderboard(rankedEntries: RankedEntry[], topN: number = 10): LeaderboardEntry[] {
    return rankedEntries
      .slice(0, topN)
      .map(entry => ({
        rank: entry.rank,
        userId: entry.userId,
        username: entry.user.kickName || entry.user.telegramUser || 'Unknown',
        guess: entry.guess,
        delta: entry.delta,
        isWinner: entry.rank <= 3, // Top 3 are winners
      }));
  }

  static calculateWinners(rankedEntries: RankedEntry[], maxWinners: number = 10): RankedEntry[] {
    return rankedEntries.slice(0, maxWinners);
  }

  static validateGuess(guess: number): { valid: boolean; error?: string } {
    if (!Number.isInteger(guess)) {
      return { valid: false, error: 'Guess must be a whole number' };
    }

    if (guess < 1) {
      return { valid: false, error: 'Guess must be at least 1' };
    }

    if (guess > 1000000) {
      return { valid: false, error: 'Guess must be at most 1,000,000' };
    }

    return { valid: true };
  }

  static validateBonusName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Bonus name cannot be empty' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Bonus name too long (max 50 characters)' };
    }

    // Check for suspicious characters
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(name)) {
        return { valid: false, error: 'Invalid characters in bonus name' };
      }
    }

    return { valid: true };
  }

  static validatePayoutAmount(amount: number): { valid: boolean; error?: string } {
    if (!Number.isInteger(amount)) {
      return { valid: false, error: 'Payout amount must be a whole number' };
    }

    if (amount < 0) {
      return { valid: false, error: 'Payout amount cannot be negative' };
    }

    if (amount > 10000) {
      return { valid: false, error: 'Payout amount too high (max 10,000x)' };
    }

    return { valid: true };
  }

  static formatGameResult(result: BonusGameResult): string {
    let message = `🏁 **Bonus Hunt Complete!**\n\n`;
    message += `Total Payout: **${result.totalPayout}x**\n`;
    message += `Entries: ${result.entries.length}\n\n`;

    if (result.entries.length > 0) {
      message += `**Top 10 Results:**\n`;
      result.entries.slice(0, 10).forEach(entry => {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
        const username = entry.user.kickName || entry.user.telegramUser || 'Unknown';
        message += `${medal} ${username}: ${entry.guess} (Δ${entry.delta})\n`;
      });
    }

    return message;
  }

  static formatLeaderboard(leaderboard: LeaderboardEntry[]): string {
    if (leaderboard.length === 0) {
      return 'No entries yet.';
    }

    let message = `**Current Leaderboard:**\n`;
    leaderboard.forEach(entry => {
      const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
      const winner = entry.isWinner ? ' 🏆' : '';
      message += `${medal} ${entry.username}: ${entry.guess} (Δ${entry.delta})${winner}\n`;
    });

    return message;
  }

  static calculatePayoutDistribution(
    winners: RankedEntry[],
    totalPrizePool: number
  ): Array<{ userId: string; amount: number; percentage: number }> {
    if (winners.length === 0) {
      return [];
    }

    // Simple distribution: 50% to 1st, 30% to 2nd, 20% to 3rd, rest split equally
    const distribution = [
      { rank: 1, percentage: 0.5 },
      { rank: 2, percentage: 0.3 },
      { rank: 3, percentage: 0.2 },
    ];

    const payouts = winners.map((winner, index) => {
      let percentage = 0;

      if (index === 0) {
        percentage = 0.5; // 50% to 1st place
      } else if (index === 1) {
        percentage = 0.3; // 30% to 2nd place
      } else if (index === 2) {
        percentage = 0.2; // 20% to 3rd place
      } else {
        // Remaining 0% split among other winners (if any)
        percentage = 0;
      }

      return {
        userId: winner.userId,
        amount: Math.floor(totalPrizePool * percentage),
        percentage: percentage * 100,
      };
    });

    return payouts.filter(payout => payout.amount > 0);
  }
}

