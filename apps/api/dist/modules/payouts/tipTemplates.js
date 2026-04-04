import { Award, User } from '@prisma/client';
export class TipTemplateGenerator {
    static generatePayoutPreview(awards) {
        const winners = awards.map((award, index) => ({
            userId: award.userId,
            username: award.user.kickName || award.user.telegramUser || 'Unknown',
            amount: award.amount,
            cwalletHandle: award.user.cwalletHandle,
            rank: index + 1,
        }));
        const tipCommands = this.generateTipCommands(winners);
        const totalAmount = this.calculateTotalAmount(awards);
        return {
            gameId: awards[0]?.gameId || '',
            winners,
            tipCommands,
            totalAmount,
            currency: 'USDT',
        };
    }
    static generateTipCommands(winners) {
        const commands = [];
        const maxCommandsPerMessage = 10; // Telegram message limit
        // Group commands into chunks
        for (let i = 0; i < winners.length; i += maxCommandsPerMessage) {
            const chunk = winners.slice(i, i + maxCommandsPerMessage);
            const chunkCommands = chunk.map(winner => {
                const handle = winner.cwalletHandle || `@${winner.username}`;
                return `/tip ${winner.amount} USDT ${handle}`;
            });
            commands.push(...chunkCommands);
            // Add separator between chunks
            if (i + maxCommandsPerMessage < winners.length) {
                commands.push('---');
            }
        }
        return commands;
    }
    static generateSummaryMessage(preview) {
        let message = `💰 **Payout Summary**\n\n`;
        message += `Game: ${preview.gameId}\n`;
        message += `Total winners: ${preview.winners.length}\n`;
        message += `Total amount: ${preview.totalAmount} ${preview.currency}\n\n`;
        if (preview.winners.length > 0) {
            message += `**Winners:**\n`;
            preview.winners.forEach(winner => {
                const medal = winner.rank === 1 ? '🥇' : winner.rank === 2 ? '🥈' : winner.rank === 3 ? '🥉' : `${winner.rank}.`;
                message += `${medal} ${winner.username}: ${winner.amount} ${preview.currency}\n`;
            });
        }
        return message;
    }
    static generateTreasurerInstructions(preview) {
        let message = `📋 **Treasurer Instructions**\n\n`;
        message += `Game: ${preview.gameId}\n`;
        message += `Total winners: ${preview.winners.length}\n`;
        message += `Total amount: ${preview.totalAmount} USDT\n\n`;
        message += `**Tip Commands:**\n`;
        message += `Copy and paste these commands in the payout group:\n\n`;
        preview.tipCommands.forEach(command => {
            message += `${command}\n`;
        });
        message += `\n**Instructions:**\n`;
        message += `1. Copy each tip command above\n`;
        message += `2. Paste them in the payout group one by one\n`;
        message += `3. Wait for @cctip_bot to process each tip\n`;
        message += `4. Mark as sent when all tips are processed\n\n`;
        message += `**Note:** Make sure @cctip_bot is in the payout group and has sufficient balance.`;
        return message;
    }
    static generatePayoutGroupMessage(preview) {
        let message = `🎉 **Payout Complete!**\n\n`;
        message += `Game: ${preview.gameId}\n`;
        message += `Winners: ${preview.winners.length}\n\n`;
        if (preview.winners.length > 0) {
            message += `**Congratulations to our winners:**\n`;
            preview.winners.slice(0, 5).forEach(winner => {
                const medal = winner.rank === 1 ? '🥇' : winner.rank === 2 ? '🥈' : winner.rank === 3 ? '🥉' : `${winner.rank}.`;
                message += `${medal} ${winner.username}\n`;
            });
            if (preview.winners.length > 5) {
                message += `... and ${preview.winners.length - 5} more!\n`;
            }
        }
        message += `\nPayout instructions have been sent to the treasurer.`;
        return message;
    }
    static calculateTotalAmount(awards) {
        return awards.reduce((total, award) => {
            const amount = parseFloat(award.amount.replace(/[^\d.]/g, ''));
            return total + (isNaN(amount) ? 0 : amount);
        }, 0);
    }
    static formatAmount(amount) {
        // Extract numeric value and format
        const numericAmount = parseFloat(amount.replace(/[^\d.]/g, ''));
        if (isNaN(numericAmount)) {
            return '0.00';
        }
        return numericAmount.toFixed(2);
    }
    static validateCwalletHandle(handle) {
        // Basic validation for Cwallet handles
        return handle.startsWith('@') && handle.length >= 4 && handle.length <= 25;
    }
    static sanitizeUsername(username) {
        // Remove special characters that might cause issues
        return username.replace(/[^a-zA-Z0-9_]/g, '');
    }
    static generateBackupInstructions(preview) {
        let message = `🔄 **Backup Instructions**\n\n`;
        message += `If automated payout fails, use these manual instructions:\n\n`;
        message += `**Game:** ${preview.gameId}\n`;
        message += `**Total Amount:** ${preview.totalAmount} USDT\n\n`;
        message += `**Manual Payout Steps:**\n`;
        message += `1. Open Cwallet app\n`;
        message += `2. Go to Send/Transfer\n`;
        message += `3. Select USDT\n`;
        message += `4. Send to each winner:\n\n`;
        preview.winners.forEach(winner => {
            const handle = winner.cwalletHandle || `@${winner.username}`;
            message += `• ${handle}: ${winner.amount} USDT\n`;
        });
        message += `\n**Important:** Keep transaction receipts for record keeping.`;
        return message;
    }
}
//# sourceMappingURL=tipTemplates.js.map