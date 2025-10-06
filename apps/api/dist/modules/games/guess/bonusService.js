import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../utils/errors.js';
export class BonusService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    // Get current bonus round
    async getCurrentRound() {
        const round = await this.prisma.gameRound.findFirst({
            where: {
                type: GameType.GUESS_BONUS,
                phase: {
                    in: ['IDLE', 'OPEN', 'CLOSED'],
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!round) {
            throw new NotFoundError('No active bonus game round found');
        }
        return round;
    }
    // Add a bonus item
    async addBonusItem(name, userId) {
        const round = await this.getCurrentRound();
        // Check if item already exists
        const existing = await this.prisma.bonusItem.findFirst({
            where: {
                gameRoundId: round.id,
                name: {
                    equals: name,
                    mode: 'insensitive',
                },
            },
        });
        if (existing) {
            return `❌ Bonus item "${name}" already exists.`;
        }
        await this.prisma.bonusItem.create({
            data: {
                gameRoundId: round.id,
                name: name.trim(),
            },
        });
        await this.logAudit(userId, 'add_bonus_item', { name });
        return `✅ Added bonus item: "${name}"`;
    }
    // Remove a bonus item
    async removeBonusItem(name, userId) {
        const round = await this.getCurrentRound();
        const item = await this.prisma.bonusItem.findFirst({
            where: {
                gameRoundId: round.id,
                name: {
                    equals: name,
                    mode: 'insensitive',
                },
            },
        });
        if (!item) {
            return `❌ Bonus item "${name}" not found.`;
        }
        await this.prisma.bonusItem.delete({
            where: { id: item.id },
        });
        await this.logAudit(userId, 'remove_bonus_item', { name });
        return `✅ Removed bonus item: "${name}"`;
    }
    // List bonus items
    async listBonusItems() {
        const round = await this.getCurrentRound();
        const items = await this.prisma.bonusItem.findMany({
            where: { gameRoundId: round.id },
            orderBy: { createdAt: 'asc' },
        });
        if (items.length === 0) {
            return `📋 **Bonus Items:**\n\nNo bonus items added yet.`;
        }
        let message = `📋 **Bonus Items:**\n\n`;
        items.forEach((item, index) => {
            const payoutText = item.payoutX ? ` (${item.payoutX}x)` : ' (not paid out)';
            message += `${index + 1}) ${item.name}${payoutText}\n`;
        });
        const totalPayout = items.reduce((sum, item) => sum + (item.payoutX || 0), 0);
        if (totalPayout > 0) {
            message += `\n💰 **Total Payout:** ${totalPayout}x`;
        }
        return message;
    }
    // Record payout for a bonus item
    async recordPayout(name, payoutX, userId) {
        const round = await this.getCurrentRound();
        if (payoutX < 0) {
            return `❌ Payout must be a positive number.`;
        }
        const item = await this.prisma.bonusItem.findFirst({
            where: {
                gameRoundId: round.id,
                name: {
                    equals: name,
                    mode: 'insensitive',
                },
            },
        });
        if (!item) {
            return `❌ Bonus item "${name}" not found.`;
        }
        await this.prisma.bonusItem.update({
            where: { id: item.id },
            data: { payoutX },
        });
        await this.logAudit(userId, 'record_bonus_payout', { name, payoutX });
        return `✅ Recorded payout for "${name}": ${payoutX}x`;
    }
    // Finalize bonus total
    async finalizeBonusTotal(userId) {
        const round = await this.getCurrentRound();
        const items = await this.prisma.bonusItem.findMany({
            where: { gameRoundId: round.id },
        });
        if (items.length === 0) {
            return `❌ No bonus items to finalize.`;
        }
        const totalPayout = items.reduce((sum, item) => sum + (item.payoutX || 0), 0);
        if (totalPayout === 0) {
            return `❌ Cannot finalize: no payouts recorded. Use /bonus payout <name> <x> to record payouts first.`;
        }
        // Set the final value for the round
        await this.prisma.gameRound.update({
            where: { id: round.id },
            data: {
                finalValue: totalPayout,
                updatedAt: new Date(),
            },
        });
        await this.logAudit(userId, 'finalize_bonus_total', { totalPayout, itemCount: items.length });
        return `✅ **Bonus Total Finalized:** ${totalPayout}x\n\nBased on ${items.length} bonus item${items.length === 1 ? '' : 's'}.`;
    }
    // Get bonus summary
    async getBonusSummary() {
        const round = await this.getCurrentRound();
        const items = await this.prisma.bonusItem.findMany({
            where: { gameRoundId: round.id },
            orderBy: { createdAt: 'asc' },
        });
        const totalPayoutX = items.reduce((sum, item) => sum + (item.payoutX || 0), 0);
        const finalized = round.finalValue !== null;
        return {
            items: items.map(item => ({
                id: item.id,
                name: item.name,
                payoutX: item.payoutX,
                createdAt: item.createdAt,
            })),
            totalPayoutX,
            finalized,
        };
    }
    // Log audit entry
    async logAudit(userId, command, params) {
        await this.prisma.auditLog.create({
            data: {
                userId,
                command,
                params: params ? JSON.stringify(params) : null,
            },
        });
    }
}
//# sourceMappingURL=bonusService.js.map