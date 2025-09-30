import { PrismaClient } from '@prisma/client';
import { Context } from 'telegraf';
import { BonusService } from './bonusService';
import { GuessService } from './guessService';
export declare class GuessCommands {
    private prisma;
    private guessService;
    private bonusService;
    constructor(prisma: PrismaClient, guessService: GuessService, bonusService: BonusService);
    private isUserLinked;
    private getUser;
    handleGtBalance(ctx: Context, args: string[]): Promise<void>;
    handleGuess(ctx: Context, args: string[]): Promise<void>;
    handleGtBonus(ctx: Context, args: string[]): Promise<void>;
    handleBalanceAdmin(ctx: Context, args: string[]): Promise<void>;
    handleBonusAdmin(ctx: Context, args: string[]): Promise<void>;
    handleGameAdmin(ctx: Context, args: string[]): Promise<void>;
    private parseTopN;
    private logAuditAttempt;
}
//# sourceMappingURL=guessCommands.d.ts.map