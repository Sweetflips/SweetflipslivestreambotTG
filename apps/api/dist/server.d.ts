export declare class Server {
    private fastify;
    private io;
    private prisma;
    private redis;
    private rateLimiter;
    private telegramBot;
    private kickChat;
    private overlayService;
    private callSessionService;
    constructor();
    initialize(): Promise<void>;
    private setupRoutes;
    private setupErrorHandling;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map