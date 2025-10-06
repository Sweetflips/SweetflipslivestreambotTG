export interface BonusGameResult {
  gameRoundId: string;
  totalPayout: number;
  entries: RankedEntry[];
  leaderboard: LeaderboardEntry[];
}

export interface RankedEntry {
  id: string;
  value: number;
  user: {
    id: string;
    kickName: string | null;
    telegramUser: string | null;
  };
  delta: number;
  rank: number;
}

export interface LeaderboardEntry {
  id: string;
  value: number;
  user: {
    id: string;
    kickName: string | null;
    telegramUser: string | null;
  };
  delta: number;
  rank: number;
}

export function calculateRankings(entries: any[], finalValue: number): RankedEntry[] {
  const rankedEntries = entries.map(entry => ({
    ...entry,
    delta: Math.abs(entry.value - finalValue),
  }));

  // Sort by delta (closest first)
  rankedEntries.sort((a, b) => a.delta - b.delta);

  // Add rank
  return rankedEntries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export function formatLeaderboard(entries: RankedEntry[]): string {
  if (entries.length === 0) {
    return 'No entries found.';
  }

  let message = '🏆 **Bonus Hunt Leaderboard**\n\n';

  entries.slice(0, 10).forEach((entry, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔸';
    const username = entry.user.kickName || entry.user.telegramUser || 'Unknown';
    message += `${medal} **#${entry.rank}** ${username}: ${entry.value} (Δ${entry.delta})\n`;
  });

  return message;
}

export function getWinner(entries: RankedEntry[]): RankedEntry | null {
  if (entries.length === 0) {
    return null;
  }

  return entries[0] ?? null; // First entry is the winner (lowest delta)
}

export function formatWinnerMessage(winner: RankedEntry): string {
  const username = winner.user.kickName || winner.user.telegramUser || 'Unknown';
  return `🎉 **Winner: ${username}**\n\n` +
         `📊 **Guess:** ${winner.value}\n` +
         `🎯 **Delta:** ${winner.delta}\n` +
         `🏆 **Rank:** #${winner.rank}`;
}

export function calculatePayouts(entries: RankedEntry[], totalPayout: number): Array<{ userId: string; amount: number }> {
  if (entries.length === 0) {
    return [];
  }

  const winner = entries[0];
  if (!winner) {
    return [];
  }

  // Simple payout: winner gets everything
  return [{
    userId: winner.user.id,
    amount: totalPayout,
  }];
}
