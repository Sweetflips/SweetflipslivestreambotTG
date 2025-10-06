export function calculateRankings(entries, finalValue) {
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
export function formatLeaderboard(entries) {
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
export function getWinner(entries) {
    if (entries.length === 0) {
        return null;
    }
    return entries[0] ?? null; // First entry is the winner (lowest delta)
}
export function formatWinnerMessage(winner) {
    const username = winner.user.kickName || winner.user.telegramUser || 'Unknown';
    return `🎉 **Winner: ${username}**\n\n` +
        `📊 **Guess:** ${winner.value}\n` +
        `🎯 **Delta:** ${winner.delta}\n` +
        `🏆 **Rank:** #${winner.rank}`;
}
export function calculatePayouts(entries, totalPayout) {
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
//# sourceMappingURL=bonusLogic.js.map