import { PrismaClient } from '@prisma/client';
export interface BonusHuntResult {
    game: any;
    totalPayout: number;
    entries: Array<{
        id: string;
        guess: number;
        user: {
            id: string;
            kickName?: string;
            telegramUser?: string;
        };
    }>;
}
export declare class BonusService {
    private prisma;
    constructor(prisma: PrismaClient);
    startGame(): Promise<any>;
    addBonus(bonusName: string): Promise<any>;
    recordPayout(bonusName: string, amountX: number): Promise<{
        gameId: any;
        name: string;
        amountX: number;
    }>;
    closeGame(): Promise<BonusHuntResult>;
    getActiveGame(): Promise<any>;
    submitGuess(gameId: string, userId: string, guess: number): Promise<any>;
    getGameState(gameId: string): Promise<any>;
}
//# sourceMappingURL=bonusService.d.ts.map