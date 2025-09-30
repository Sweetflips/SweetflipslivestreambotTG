import { PrismaClient } from '@prisma/client';
export interface BonusItem {
    id: string;
    name: string;
    payoutX: number | null;
    createdAt: Date;
}
export interface BonusSummary {
    items: BonusItem[];
    totalPayoutX: number;
    finalized: boolean;
}
export declare class BonusService {
    private prisma;
    constructor(prisma: PrismaClient);
    private getCurrentRound;
    addBonusItem(name: string, userId: string): Promise<string>;
    removeBonusItem(name: string, userId: string): Promise<string>;
    listBonusItems(): Promise<string>;
    recordPayout(name: string, payoutX: number, userId: string): Promise<string>;
    finalizeBonusTotal(userId: string): Promise<string>;
    getBonusSummary(): Promise<BonusSummary>;
    private logAudit;
}
//# sourceMappingURL=bonusService.d.ts.map