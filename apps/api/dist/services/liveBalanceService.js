import { logger } from '../telemetry/logger';
export class LiveBalanceService {
    bearerToken;
    balanceApiUrl;
    lastBalance = null;
    lastUpdate = null;
    constructor(bearerToken, balanceApiUrl) {
        this.bearerToken = bearerToken;
        this.balanceApiUrl = balanceApiUrl || 'https://api.example.com/balance'; // Default URL
    }
    /**
     * Fetch current live balance from external API
     */
    async fetchCurrentBalance() {
        try {
            const response = await fetch(this.balanceApiUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.bearerToken}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            // Extract balance from response - adjust this based on actual API response structure
            const currentBalance = this.extractBalanceFromResponse(data);
            this.lastBalance = currentBalance;
            this.lastUpdate = new Date();
            logger.info(`Live balance fetched: ${currentBalance}`);
            return {
                currentBalance,
                lastUpdated: this.lastUpdate,
                source: this.balanceApiUrl,
            };
        }
        catch (error) {
            logger.error('Failed to fetch live balance:', error);
            throw error;
        }
    }
    /**
     * Extract balance value from API response
     * This method should be customized based on the actual API response structure
     */
    extractBalanceFromResponse(data) {
        // Common patterns for balance extraction
        if (typeof data.balance === 'number')
            return data.balance;
        if (typeof data.currentBalance === 'number')
            return data.currentBalance;
        if (typeof data.amount === 'number')
            return data.amount;
        if (typeof data.value === 'number')
            return data.value;
        // If balance is nested in an object
        if (data.data && typeof data.data.balance === 'number')
            return data.data.balance;
        if (data.result && typeof data.result.balance === 'number')
            return data.result.balance;
        // If balance is a string, try to parse it
        if (typeof data.balance === 'string') {
            const parsed = parseFloat(data.balance);
            if (!isNaN(parsed))
                return parsed;
        }
        throw new Error('Could not extract balance from API response');
    }
    /**
     * Get cached balance if available and not too old
     */
    getCachedBalance(maxAgeMinutes = 5) {
        if (!this.lastBalance || !this.lastUpdate)
            return null;
        const ageMinutes = (Date.now() - this.lastUpdate.getTime()) / (1000 * 60);
        if (ageMinutes > maxAgeMinutes)
            return null;
        return {
            currentBalance: this.lastBalance,
            lastUpdated: this.lastUpdate,
            source: this.balanceApiUrl,
        };
    }
    /**
     * Calculate leaderboard entries based on current balance and user guesses
     */
    calculateLeaderboard(currentBalance, userGuesses) {
        return userGuesses
            .map(guess => ({
            ...guess,
            difference: Math.abs(guess.guess - currentBalance),
            isExact: guess.guess === currentBalance,
        }))
            .sort((a, b) => {
            // Sort by difference (closest first), then by exact matches, then by guess time
            if (a.difference !== b.difference) {
                return a.difference - b.difference;
            }
            if (a.isExact !== b.isExact) {
                return a.isExact ? -1 : 1;
            }
            return 0; // Could add timestamp sorting here if needed
        })
            .map((entry, index) => ({
            rank: index + 1,
            telegramUsername: entry.telegramUsername,
            kickUsername: entry.kickUsername,
            guess: entry.guess,
            difference: entry.difference,
            isExact: entry.isExact,
        }));
    }
    /**
     * Format leaderboard for display
     */
    formatLeaderboard(entries, showTop = 10) {
        if (entries.length === 0) {
            return '📊 No guesses recorded yet.';
        }
        const topEntries = entries.slice(0, showTop);
        let leaderboard = '🏆 **Live Balance Leaderboard**\n\n';
        topEntries.forEach(entry => {
            const medal = entry.rank === 1
                ? '🥇'
                : entry.rank === 2
                    ? '🥈'
                    : entry.rank === 3
                        ? '🥉'
                        : `${entry.rank}.`;
            const exact = entry.isExact ? '🎯' : '';
            const displayName = entry.kickUsername ? `@${entry.kickUsername}` : entry.telegramUsername;
            leaderboard += `${medal} ${displayName} - ${entry.guess.toLocaleString()}${exact}\n`;
        });
        if (entries.length > showTop) {
            leaderboard += `\n... and ${entries.length - showTop} more`;
        }
        return leaderboard;
    }
}
//# sourceMappingURL=liveBalanceService.js.map