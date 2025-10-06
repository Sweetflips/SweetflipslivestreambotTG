import { PrismaClient } from '@prisma/client';
export interface BonusHuntResult {
    gameRound: any;
    totalPayout: number;
    entries: Array<{
        id: string;
        value: number;
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
    startGame(): Promise<{
        type: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phase: string;
        finalValue: number | null;
        graceWindow: number;
        windowMin: number;
        minRange: number;
        maxRange: number;
        closedAt: Date | null;
        revealedAt: Date | null;
    }>;
    closeGame(gameRoundId: string): Promise<{
        type: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phase: string;
        finalValue: number | null;
        graceWindow: number;
        windowMin: number;
        minRange: number;
        maxRange: number;
        closedAt: Date | null;
        revealedAt: Date | null;
    }>;
    revealGame(gameRoundId: string, finalValue: number): Promise<{
        type: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phase: string;
        finalValue: number | null;
        graceWindow: number;
        windowMin: number;
        minRange: number;
        maxRange: number;
        closedAt: Date | null;
        revealedAt: Date | null;
    }>;
    submitGuess(gameRoundId: string, userId: string, guess: number): Promise<{
        user: {
            id: string;
            kickName: string | null;
            telegramUser: string | null;
        };
    } & {
        value: number;
        userId: string;
        id: string;
        createdAt: Date;
        gameRoundId: string;
        editedAt: Date | null;
        isArchived: boolean;
    }>;
    getGameResults(gameRoundId: string): Promise<BonusHuntResult>;
    getCurrentGame(): Promise<{
        type: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        phase: string;
        finalValue: number | null;
        graceWindow: number;
        windowMin: number;
        minRange: number;
        maxRange: number;
        closedAt: Date | null;
        revealedAt: Date | null;
    } | null>;
    getLeaderboard(gameRoundId: string): Promise<{
        distance: number;
        user: {
            id: string;
            kickName: string | null;
            telegramUser: string | null;
        };
        value: number;
        userId: string;
        id: string;
        createdAt: Date;
        gameRoundId: string;
        editedAt: Date | null;
        isArchived: boolean;
    }[]>;
}
//# sourceMappingURL=bonusService.d.ts.map