import { PrismaClient } from '@prisma/client';
export interface GuessResult {
    success: boolean;
    message: string;
    isEdit?: boolean;
    graceWindowRemaining?: number;
}
export interface GameConfig {
    minRange: number;
    maxRange: number;
    graceWindow: number;
    windowMin: number;
}
export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    kickName: string;
    guess: number;
    delta: number;
    isExact: boolean;
    createdAt: Date;
}
export declare class GuessService {
    private prisma;
    constructor(prisma: PrismaClient);
    private getDefaultConfig;
    getCurrentRound(gameType: GameType): Promise<{
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
    submitGuess(userId: string, gameType: GameType, value: number, isEdit?: boolean): Promise<GuessResult>;
    openRound(gameType: GameType, userId: string): Promise<string>;
    closeRound(gameType: GameType, userId: string): Promise<string>;
    setFinalValue(gameType: GameType, value: number, userId: string): Promise<string>;
    revealResults(gameType: GameType, userId: string, topN?: number): Promise<string>;
    completeGameRound(gameType: GameType, userId: string): Promise<string>;
    getLeaderboard(gameType: GameType, topN?: number): Promise<LeaderboardEntry[]>;
    showStandings(gameType: GameType, topN?: number): Promise<string>;
    resetRound(gameType: GameType, userId: string): Promise<string>;
    startNewRound(gameType: GameType, userId: string): Promise<string>;
    updateConfig(gameType: GameType, config: Partial<GameConfig>, userId: string): Promise<string>;
    exportGuesses(gameType: GameType): Promise<string>;
    private logAudit;
    isAdmin(userId: string): Promise<boolean>;
    isOwner(userId: string): Promise<boolean>;
    getArchivedGames(gameType?: any, limit?: number): Promise<any[]>;
    getArchivedGameDetails(archiveId: string): Promise<any>;
    cleanupOldArchives(daysToKeep: number | undefined, userId: string): Promise<string>;
    getGameStatistics(gameType?: any): Promise<any>;
}
//# sourceMappingURL=guessService.d.ts.map