import { PrismaClient } from '@prisma/client';
export interface PayoutPreview {
    gameId: string;
    winners: Array<{
        id: string;
        cwalletHandle: string;
        amount: number;
        position: number;
    }>;
    tipCommands: string[];
}
export declare class PayoutService {
    private prisma;
    constructor(prisma: PrismaClient);
    generatePayoutPreview(): Promise<PayoutPreview | null>;
    createAward(userId: string, gameId: string, amount: number, currency?: string): Promise<any>;
    updateAwardStatus(awardId: string, status: string, tipCommand?: string): Promise<any>;
    getAwardsByGame(gameId: string): Promise<any>;
    getAwardsByUser(userId: string): Promise<any>;
}
//# sourceMappingURL=payoutService.d.ts.map