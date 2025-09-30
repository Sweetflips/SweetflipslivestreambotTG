import { PrismaClient } from '@prisma/client';
import { RateLimiter } from '../../utils/rateLimit.js';
export declare class TelegramBot {
    private prisma;
    private redis;
    private rateLimiter;
    private bot;
    private commands;
    constructor(prisma: PrismaClient, redis: any, rateLimiter: RateLimiter);
    private setupMiddlewares;
    private setupCommands;
    setupWebhook(): Promise<void>;
    removeWebhook(): Promise<void>;
    getWebhookHandler(): (req: import("http").IncomingMessage & {
        body?: import("@telegraf/types").Update | undefined;
    }, res: import("http").ServerResponse<import("http").IncomingMessage>, next?: (() => void) | undefined) => Promise<void>;
    startPolling(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=telegramBot.d.ts.map