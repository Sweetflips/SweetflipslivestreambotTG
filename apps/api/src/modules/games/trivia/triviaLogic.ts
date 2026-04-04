// import { TriviaAnswer, TriviaRound } from '@prisma/client'; // Types don't exist
import { isAnswerClose } from '../../../utils/regex.js';

export interface TriviaGameResult {
  gameId: string;
  totalRounds: number;
  scores: TriviaScore[];
  leaderboard: TriviaLeaderboardEntry[];
}

export interface TriviaScore {
  userId: string;
  username: string;
  points: number;
  correctAnswers: number;
  totalAnswers: number;
  accuracy: number;
}

export interface TriviaLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  points: number;
  correctAnswers: number;
  accuracy: number;
}

export interface TriviaRoundResult {
  roundId: string;
  gameId: string;
  question: string;
  answer: string;
  correctAnswers: TriviaAnswerWithUser[];
  totalAnswers: number;
  correctCount: number;
}

export interface TriviaAnswerWithUser extends TriviaAnswer {
  user: {
    id: string;
    kickName: string | null;
    telegramUser: string | null;
  };
}

export class TriviaLogic {
  static evaluateAnswer(userAnswer: string, correctAnswer: string): boolean {
    return isAnswerClose(userAnswer, correctAnswer);
  }

  static calculateScores(
    rounds: (TriviaRound & {
      answers: TriviaAnswerWithUser[];
    })[]
  ): TriviaScore[] {
    const userScores = new Map<string, {
      userId: string;
      username: string;
      points: number;
      correctAnswers: number;
      totalAnswers: number;
    }>();

    // Process each round
    for (const round of rounds) {
      // Get first correct answer per user for this round
      const firstCorrectPerUser = new Map<string, TriviaAnswerWithUser>();

      for (const answer of round.answers) {
        if (answer.isCorrect && !firstCorrectPerUser.has(answer.userId)) {
          firstCorrectPerUser.set(answer.userId, answer);
        }
      }

      // Award points to first correct answers
      for (const [userId, answer] of firstCorrectPerUser) {
        const existing = userScores.get(userId) || {
          userId,
          username: answer.user.kickName || answer.user.telegramUser || 'Unknown',
          points: 0,
          correctAnswers: 0,
          totalAnswers: 0,
        };

        existing.points += 1; // 1 point per correct answer
        existing.correctAnswers += 1;
        existing.totalAnswers += 1;

        userScores.set(userId, existing);
      }

      // Count total answers (including incorrect ones)
      for (const answer of round.answers) {
        const existing = userScores.get(answer.userId) || {
          userId: answer.userId,
          username: answer.user.kickName || answer.user.telegramUser || 'Unknown',
          points: 0,
          correctAnswers: 0,
          totalAnswers: 0,
        };

        existing.totalAnswers += 1;
        userScores.set(answer.userId, existing);
      }
    }

    // Convert to array and calculate accuracy
    return Array.from(userScores.values()).map(score => ({
      ...score,
      accuracy: score.totalAnswers > 0 ? (score.correctAnswers / score.totalAnswers) * 100 : 0,
    }));
  }

  static generateLeaderboard(scores: TriviaScore[], topN: number = 10): TriviaLeaderboardEntry[] {
    return scores
      .sort((a, b) => {
        // Primary sort: by points (descending)
        if (a.points !== b.points) {
          return b.points - a.points;
        }
        // Secondary sort: by accuracy (descending)
        if (a.accuracy !== b.accuracy) {
          return b.accuracy - a.accuracy;
        }
        // Tertiary sort: by correct answers (descending)
        return b.correctAnswers - a.correctAnswers;
      })
      .slice(0, topN)
      .map((score, index) => ({
        rank: index + 1,
        userId: score.userId,
        username: score.username,
        points: score.points,
        correctAnswers: score.correctAnswers,
        accuracy: Math.round(score.accuracy * 100) / 100,
      }));
  }

  static validateQuestion(question: string): { valid: boolean; error?: string } {
    if (!question || question.trim().length === 0) {
      return { valid: false, error: 'Question cannot be empty' };
    }

    if (question.length > 500) {
      return { valid: false, error: 'Question too long (max 500 characters)' };
    }

    // Check for suspicious characters
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(question)) {
        return { valid: false, error: 'Invalid characters in question' };
      }
    }

    return { valid: true };
  }

  static validateAnswer(answer: string): { valid: boolean; error?: string } {
    if (!answer || answer.trim().length === 0) {
      return { valid: false, error: 'Answer cannot be empty' };
    }

    if (answer.length > 100) {
      return { valid: false, error: 'Answer too long (max 100 characters)' };
    }

    // Check for suspicious characters
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(answer)) {
        return { valid: false, error: 'Invalid characters in answer' };
      }
    }

    return { valid: true };
  }

  static formatGameResult(result: TriviaGameResult): string {
    let message = `🏁 **Trivia Game Complete!**\n\n`;
    message += `Total rounds: ${result.totalRounds}\n`;
    message += `Participants: ${result.scores.length}\n\n`;

    if (result.scores.length > 0) {
      message += `**Final Scores:**\n`;
      result.leaderboard.slice(0, 10).forEach(entry => {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
        message += `${medal} ${entry.username}: ${entry.points} points (${entry.correctAnswers} correct)\n`;
      });
    }

    return message;
  }

  static formatRoundResult(result: TriviaRoundResult): string {
    let message = `🔒 **Round Complete!**\n\n`;
    message += `Question: ${result.question}\n`;
    message += `Answer: ${result.answer}\n`;
    message += `Correct answers: ${result.correctCount}/${result.totalAnswers}\n\n`;

    if (result.correctAnswers.length > 0) {
      message += `**Correct answers:**\n`;
      result.correctAnswers.forEach((answer, index) => {
        const username = answer.user.kickName || answer.user.telegramUser || 'Unknown';
        message += `${index + 1}. ${username}\n`;
      });
    }

    return message;
  }

  static formatLeaderboard(leaderboard: TriviaLeaderboardEntry[]): string {
    if (leaderboard.length === 0) {
      return 'No scores yet.';
    }

    let message = `**Trivia Leaderboard:**\n`;
    leaderboard.forEach(entry => {
      const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
      message += `${medal} ${entry.username}: ${entry.points} points (${entry.accuracy}% accuracy)\n`;
    });

    return message;
  }

  static calculatePayoutDistribution(
    leaderboard: TriviaLeaderboardEntry[],
    totalPrizePool: number
  ): Array<{ userId: string; amount: number; percentage: number }> {
    if (leaderboard.length === 0) {
      return [];
    }

    // Top 3 get prizes: 50%, 30%, 20%
    const distribution = [
      { rank: 1, percentage: 0.5 },
      { rank: 2, percentage: 0.3 },
      { rank: 3, percentage: 0.2 },
    ];

    const payouts = leaderboard.slice(0, 3).map((entry, index) => {
      const percentage = distribution[index]?.percentage || 0;
      return {
        userId: entry.userId,
        amount: Math.floor(totalPrizePool * percentage),
        percentage: percentage * 100,
      };
    });

    return payouts.filter(payout => payout.amount > 0);
  }

  static getRoundStats(round: TriviaRound & { answers: TriviaAnswerWithUser[] }): {
    totalAnswers: number;
    correctAnswers: number;
    uniqueCorrectUsers: number;
    averageResponseTime: number;
  } {
    const totalAnswers = round.answers.length;
    const correctAnswers = round.answers.filter((a: any) => a.isCorrect).length;
    const uniqueCorrectUsers = new Set(round.answers.filter((a: any) => a.isCorrect).map((a: any) => a.userId)).size;

    // Calculate average response time (simplified)
    const responseTimes = round.answers.map((a: any) =>
      a.ts.getTime() - round.startedAt.getTime()
    );
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    return {
      totalAnswers,
      correctAnswers,
      uniqueCorrectUsers,
      averageResponseTime,
    };
  }
}

