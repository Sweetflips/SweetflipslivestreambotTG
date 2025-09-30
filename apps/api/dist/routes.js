import { PrismaClient, Role } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { createRBACPreHandler } from './auth/rbac.js';
import { BonusController } from './modules/games/bonus/bonusController.js';
import { BonusService } from './modules/games/bonus/bonusService.js';
import { TriviaController } from './modules/games/trivia/triviaController.js';
import { TriviaService } from './modules/games/trivia/triviaService.js';
import { LinkController } from './modules/linking/linkController.js';
import { LinkService } from './modules/linking/linkService.js';
import { ScheduleController } from './modules/schedule/scheduleController.js';
import { ScheduleService } from './services/scheduleService.js';
export async function registerRoutes(fastify) {
    const prisma = fastify.prisma;
    // Initialize services and controllers
    const bonusService = new BonusService(prisma);
    const triviaService = new TriviaService(prisma);
    const linkService = new LinkService(prisma);
    const scheduleService = new ScheduleService(prisma);
    const bonusController = new BonusController(bonusService);
    const triviaController = new TriviaController(triviaService);
    const linkController = new LinkController(linkService);
    const scheduleController = new ScheduleController(scheduleService);
    // Game API routes
    fastify.register(async function (fastify) {
        // Bonus game routes
        fastify.register(async function (fastify) {
            fastify.addHook('preHandler', createRBACPreHandler(Role.MOD));
            fastify.post('/start', bonusController.startGame.bind(bonusController));
            fastify.post('/add-bonus', bonusController.addBonus.bind(bonusController));
            fastify.post('/record-payout', bonusController.recordPayout.bind(bonusController));
            fastify.post('/close', bonusController.closeGame.bind(bonusController));
            fastify.get('/current', bonusController.getCurrentGame.bind(bonusController));
            fastify.get('/leaderboard', bonusController.getLeaderboard.bind(bonusController));
        }, { prefix: '/bonus' });
        // Trivia game routes
        fastify.register(async function (fastify) {
            fastify.addHook('preHandler', createRBACPreHandler(Role.MOD));
            fastify.post('/start', triviaController.startGame.bind(triviaController));
            fastify.post('/create-round', triviaController.createRound.bind(triviaController));
            fastify.post('/lock-round', triviaController.lockRound.bind(triviaController));
            fastify.post('/stop', triviaController.stopGame.bind(triviaController));
            fastify.get('/current', triviaController.getCurrentGame.bind(triviaController));
            fastify.get('/current-round', triviaController.getCurrentRound.bind(triviaController));
            fastify.get('/leaderboard', triviaController.getLeaderboard.bind(triviaController));
        }, { prefix: '/trivia' });
        // Public game routes (for viewers)
        fastify.post('/bonus/submit-guess', bonusController.submitGuess.bind(bonusController));
        fastify.post('/trivia/submit-answer', triviaController.submitAnswer.bind(triviaController));
    }, { prefix: '/api/games' });
    // Link API routes
    fastify.register(async function (fastify) {
        fastify.post('/generate-code', linkController.generateLinkCode.bind(linkController));
        fastify.post('/verify', linkController.verifyLinkCode.bind(linkController));
        fastify.post('/unlink', linkController.unlinkAccount.bind(linkController));
        fastify.get('/status/:userId', linkController.getLinkStatus.bind(linkController));
        fastify.post('/set-cwallet', linkController.setCwalletHandle.bind(linkController));
        fastify.get('/active-codes/:telegramId', linkController.getActiveLinkCodes.bind(linkController));
        fastify.get('/validate/:code', linkController.validateLinkCode.bind(linkController));
        fastify.post('/cleanup', linkController.cleanupExpiredCodes.bind(linkController));
    }, { prefix: '/api/link' });
    // Admin API routes
    fastify.register(async function (fastify) {
        fastify.addHook('preHandler', createRBACPreHandler(Role.OWNER));
        fastify.post('/recompute', async (request, reply) => {
            // TODO: Implement recompute logic
            return reply.send({ message: 'Recompute not implemented yet' });
        });
        fastify.get('/stats', async (request, reply) => {
            try {
                const stats = await prisma.$transaction(async (tx) => {
                    const [totalUsers, totalGames, totalAwards, activeGames,] = await Promise.all([
                        tx.user.count(),
                        tx.game.count(),
                        tx.award.count(),
                        tx.game.count({
                            where: {
                                status: {
                                    in: ['RUNNING', 'OPENING'],
                                },
                            },
                        }),
                    ]);
                    return {
                        totalUsers,
                        totalGames,
                        totalAwards,
                        activeGames,
                    };
                });
                return reply.send({
                    success: true,
                    data: stats,
                });
            }
            catch (error) {
                fastify.log.error('Failed to get admin stats:', error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to get admin stats',
                });
            }
        });
    }, { prefix: '/api/admin' });
    // Overlay API routes
    fastify.register(async function (fastify) {
        fastify.get('/state', async (request, reply) => {
            try {
                const currentGame = await prisma.game.findFirst({
                    where: {
                        status: {
                            in: ['RUNNING', 'OPENING'],
                        },
                    },
                    include: {
                        bonusEntries: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        kickName: true,
                                        telegramUser: true,
                                    },
                                },
                            },
                        },
                        payouts: true,
                        triviaRounds: {
                            where: {
                                status: 'OPEN',
                            },
                            include: {
                                answers: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                kickName: true,
                                                telegramUser: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        scores: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        kickName: true,
                                        telegramUser: true,
                                    },
                                },
                            },
                            orderBy: {
                                points: 'desc',
                            },
                            take: 10,
                        },
                    },
                });
                return reply.send({
                    success: true,
                    data: {
                        game: currentGame,
                        timestamp: new Date().toISOString(),
                    },
                });
            }
            catch (error) {
                fastify.log.error('Failed to get overlay state:', error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to get overlay state',
                });
            }
        });
        fastify.get('/connections', async (request, reply) => {
            try {
                const overlayService = fastify.overlayService;
                if (!overlayService) {
                    return reply.status(503).send({
                        success: false,
                        error: 'Overlay service not available',
                    });
                }
                const connections = overlayService.getConnections();
                return reply.send({
                    success: true,
                    data: {
                        count: connections.length,
                        connections,
                    },
                });
            }
            catch (error) {
                fastify.log.error('Failed to get overlay connections:', error);
                return reply.status(500).send({
                    success: false,
                    error: 'Failed to get overlay connections',
                });
            }
        });
    }, { prefix: '/api/overlay' });
    // Schedule API routes
    fastify.register(async function (fastify) {
        const modPreHandler = createRBACPreHandler([Role.MOD, Role.OWNER]);
        fastify.get('/', scheduleController.getSchedule.bind(scheduleController));
        fastify.get('/next', scheduleController.getNextStreams.bind(scheduleController));
        fastify.get('/times', scheduleController.getStreamTimes.bind(scheduleController));
        fastify.post('/add', { preHandler: modPreHandler }, scheduleController.addScheduleEntry.bind(scheduleController));
        fastify.post('/remove', { preHandler: modPreHandler }, scheduleController.removeScheduleEntry.bind(scheduleController));
    }, { prefix: '/api/schedule' });
    // Health and status routes
    fastify.get('/api/health', async (request, reply) => {
        try {
            // Check database connection
            await prisma.$queryRaw `SELECT 1`;
            // Check if sweet_calls_rounds table exists and is accessible using Prisma ORM
            await prisma.sweetCallsRound.findFirst();
            // Check Redis connection
            const redis = fastify.redis;
            if (redis) {
                await redis.ping();
            }
            return reply.send({
                success: true,
                data: {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        database: 'connected',
                        redis: redis ? 'connected' : 'not configured',
                    },
                },
            });
        }
        catch (error) {
            fastify.log.error('Health check failed:', error);
            return reply.status(503).send({
                success: false,
                error: 'Service unhealthy',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    });
    // Webhook routes
    fastify.register(async function (fastify) {
        // Telegram webhook
        fastify.post('/telegram/webhook', async (request, reply) => {
            try {
                const telegramBot = fastify.telegramBot;
                if (!telegramBot) {
                    return reply.status(503).send({
                        success: false,
                        error: 'Telegram bot not available',
                    });
                }
                const webhookHandler = telegramBot.getWebhookHandler();
                await webhookHandler(request, reply);
            }
            catch (error) {
                fastify.log.error('Telegram webhook error:', error);
                return reply.status(500).send({
                    success: false,
                    error: 'Webhook processing failed',
                });
            }
        });
        // Kick webhook (if needed)
        fastify.post('/kick/webhook', async (request, reply) => {
            // TODO: Implement Kick webhook if needed
            return reply.send({ message: 'Kick webhook not implemented' });
        });
    }, { prefix: '/webhooks' });
}
//# sourceMappingURL=routes.js.map