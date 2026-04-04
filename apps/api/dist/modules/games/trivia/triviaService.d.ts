import { PrismaClient } from '@prisma/client';
export interface TriviaResult {
    game: any;
    totalRounds: number;
    scores: Array<{
        id: string;
        points: number;
        user: {
            id: string;
            kickName?: string;
            telegramUser?: string;
        };
    }>;
}
export interface RoundResult {
    gameId: string;
    roundId: string;
    correctAnswers: Array<{
        id: string;
        user: {
            id: string;
            kickName?: string;
            telegramUser?: string;
        };
    }>;
}
export declare class TriviaService {
    private prisma;
    constructor(prisma: PrismaClient);
    startGame(): Promise<any>;
    createRound(question: string, answer: string): Promise<any>;
    submitAnswer(roundId: string, userId: string, answer: string): Promise<any>;
    lockRound(): Promise<RoundResult>;
    stopGame(): Promise<TriviaResult>;
    getActiveGame(): Promise<any>;
    getCurrentOpenRound(gameId: string): Promise<any>;
    getGameState(gameId: string): Promise<any>;
}
//# sourceMappingURL=triviaService.d.ts.map