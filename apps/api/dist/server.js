import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { AuthService, createRBACPreHandler } from './auth/rbac.js';
import { getEnv } from './config/env.js';
import { BonusService } from './modules/games/bonus/bonusService.js';
import { TriviaService } from './modules/games/trivia/triviaService.js';
import { KickChatProvider } from './modules/kick/kickChat.js';
import { LinkService } from './modules/linking/linkService.js';
import { OverlayService } from './modules/overlay/overlayService.js';
import { PayoutService } from './modules/payouts/payoutService.js';
import { TelegramBot } from './modules/telegram/telegramBot.js';
import { CallSessionService } from './services/callSessionService.js';
import { createRequestLogger, logger } from './telemetry/logger.js';
import { RateLimiter } from './utils/rateLimit.js';
const env = getEnv();
export class Server {
    fastify;
    io;
    prisma;
    redis;
    rateLimiter;
    telegramBot;
    kickChat;
    overlayService;
    callSessionService;
    constructor() {
        this.fastify = Fastify({
            logger: false, // We'll use our own logger
        });
        this.prisma = new PrismaClient();
        this.redis = new Redis(env.REDIS_URL);
        this.rateLimiter = new RateLimiter(this.redis);
        // Initialize services
        const authService = new AuthService(this.prisma);
        const bonusService = new BonusService(this.prisma);
        const triviaService = new TriviaService(this.prisma);
        const linkService = new LinkService(this.prisma);
        const payoutService = new PayoutService(this.prisma);
        this.callSessionService = new CallSessionService(this.prisma);
        // Initialize Telegram bot
        this.telegramBot = new TelegramBot(this.prisma, this.redis, this.rateLimiter);
        // Initialize Kick chat
        this.kickChat = new KickChatProvider(authService, bonusService, triviaService, linkService, this.rateLimiter);
        // Initialize Socket.IO
        this.io = new SocketIOServer(this.fastify.server, {
            cors: {
                origin: env.OVERLAY_CORS_ORIGIN,
                methods: ['GET', 'POST'],
            },
        });
        // Initialize overlay service
        this.overlayService = new OverlayService(this.io, bonusService, triviaService);
        this.setupRoutes();
        this.setupErrorHandling();
    }
    setupRoutes() {
        // Health check
        this.fastify.get('/healthz', async (request, reply) => {
            return { status: 'ok', timestamp: new Date().toISOString() };
        });
        // Game state endpoint
        this.fastify.get('/state', async (request, reply) => {
            const state = await this.overlayService.getCurrentState();
            return state;
        });
        // Overlay state endpoint
        this.fastify.get('/overlay/state', async (request, reply) => {
            const state = await this.overlayService.getCurrentState();
            return state;
        });
        // Admin endpoints
        this.fastify.post('/admin/recompute', {
            preHandler: createRBACPreHandler('OWNER'),
        }, async (request, reply) => {
            // Recompute game results logic would go here
            return { message: 'Recomputation completed' };
        });
        // Link verification endpoint
        this.fastify.post('/link/verify', async (request, reply) => {
            const { code, kickName } = request.body;
            try {
                const success = await this.kickChat.linkService.verifyLinkCode(code, kickName);
                return { success };
            }
            catch (error) {
                reply.code(400);
                return { success: false, error: error.message };
            }
        });
        // Telegram webhook
        this.fastify.post('/webhook/telegram', async (request, reply) => {
            const webhookHandler = this.telegramBot.getWebhookHandler();
            return webhookHandler(request, reply);
        });
        // Call Session API routes
        this.fastify.get('/call-sessions/active', async (request, reply) => {
            try {
                const activeSession = await this.callSessionService.getActiveCallSession();
                if (!activeSession) {
                    reply.code(404);
                    return { success: false, message: 'No active call session found' };
                }
                return { success: true, session: activeSession };
            }
            catch (error) {
                reply.code(500);
                return { success: false, message: 'Error getting active session', error: error.message };
            }
        });
        this.fastify.post('/call-sessions/create', {
            preHandler: createRBACPreHandler('MOD'),
        }, async (request, reply) => {
            try {
                const newSession = await this.callSessionService.createNewCallSession();
                if (!newSession) {
                    reply.code(500);
                    return { success: false, message: 'Failed to create new session' };
                }
                return { success: true, session: newSession };
            }
            catch (error) {
                reply.code(500);
                return { success: false, message: 'Error creating session', error: error.message };
            }
        });
        this.fastify.post('/call-sessions/:sessionId/close', {
            preHandler: createRBACPreHandler('MOD'),
        }, async (request, reply) => {
            try {
                const { sessionId } = request.params;
                const success = await this.callSessionService.closeCallSession(sessionId);
                if (!success) {
                    reply.code(500);
                    return { success: false, message: 'Failed to close session' };
                }
                return { success: true, message: 'Session closed successfully' };
            }
            catch (error) {
                reply.code(500);
                return { success: false, message: 'Error closing session', error: error.message };
            }
        });
        this.fastify.post('/call-sessions/:sessionId/reveal', {
            preHandler: createRBACPreHandler('MOD'),
        }, async (request, reply) => {
            try {
                const { sessionId } = request.params;
                const success = await this.callSessionService.revealCallSession(sessionId);
                if (!success) {
                    reply.code(500);
                    return { success: false, message: 'Failed to reveal session' };
                }
                return { success: true, message: 'Session revealed successfully' };
            }
            catch (error) {
                reply.code(500);
                return { success: false, message: 'Error revealing session', error: error.message };
            }
        });
        this.fastify.post('/call-entries', async (request, reply) => {
            try {
                const { userId, slotName } = request.body;
                if (!userId || !slotName) {
                    reply.code(400);
                    return { success: false, message: 'userId and slotName are required' };
                }
                const result = await this.callSessionService.makeCallEntry(userId, slotName);
                if (!result.success) {
                    reply.code(400);
                }
                return result;
            }
            catch (error) {
                reply.code(500);
                return { success: false, message: 'Error making call entry', error: error.message };
            }
        });
        this.fastify.get('/call-entries', async (request, reply) => {
            try {
                const { sessionId } = request.query;
                const entries = await this.callSessionService.getSessionCallEntries(sessionId);
                return { success: true, entries };
            }
            catch (error) {
                reply.code(500);
                return { success: false, message: 'Error getting call entries', error: error.message };
            }
        });
        this.fastify.post('/call-entries/:sessionId/:slotName/multiplier', {
            preHandler: createRBACPreHandler('MOD'),
        }, async (request, reply) => {
            try {
                const { sessionId, slotName } = request.params;
                const { multiplier } = request.body;
                if (typeof multiplier !== 'number') {
                    reply.code(400);
                    return { success: false, message: 'multiplier must be a number' };
                }
                const success = await this.callSessionService.setSlotMultiplier(sessionId, slotName, multiplier);
                if (!success) {
                    reply.code(500);
                    return { success: false, message: 'Failed to set multiplier' };
                }
                return { success: true, message: 'Multiplier set successfully' };
            }
            catch (error) {
                reply.code(500);
                return { success: false, message: 'Error setting multiplier', error: error.message };
            }
        });
    }
    setupErrorHandling() {
        this.fastify.setErrorHandler(async (error, request, reply) => {
            const requestLogger = createRequestLogger(request.id);
            requestLogger.error('Request error:', error);
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';
            reply.code(statusCode).send({
                error: message,
                statusCode,
                timestamp: new Date().toISOString(),
            });
        });
        this.fastify.setNotFoundHandler(async (request, reply) => {
            reply.code(404).send({
                error: 'Not Found',
                statusCode: 404,
                timestamp: new Date().toISOString(),
            });
        });
    }
    async start() {
        try {
            // Connect to database
            await this.prisma.$connect();
            logger.info('Connected to database');
            // Initialize CallSessionService
            await this.callSessionService.initialize();
            logger.info('CallSessionService initialized');
            // Connect to Redis
            await this.redis.ping();
            logger.info('Connected to Redis');
            // Start HTTP server
            await this.fastify.listen({ port: env.PORT, host: '0.0.0.0' });
            logger.info(`Server listening on port ${env.PORT}`);
            // Setup Telegram webhook
            await this.telegramBot.setupWebhook();
            logger.info('Telegram webhook configured');
            // Connect to Kick chat
            await this.kickChat.connect();
            logger.info('Connected to Kick chat');
            logger.info('SweetflipsStreamBot started successfully');
        }
        catch (error) {
            logger.error('Failed to start server:', error);
            throw error;
        }
    }
    async stop() {
        try {
            // Stop Telegram bot
            await this.telegramBot.stop();
            // Disconnect from Kick chat
            await this.kickChat.disconnect();
            // Close Socket.IO
            this.io.close();
            // Close HTTP server
            await this.fastify.close();
            // Disconnect from Redis
            await this.redis.quit();
            // Disconnect from database
            await this.prisma.$disconnect();
            logger.info('Server stopped successfully');
        }
        catch (error) {
            logger.error('Error stopping server:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=server.js.map