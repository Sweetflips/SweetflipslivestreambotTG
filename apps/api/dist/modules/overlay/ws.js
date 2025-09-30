import { PrismaClient } from '@prisma/client';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../../telemetry/logger.js';
import { BonusService } from '../games/bonus/bonusService.js';
import { TriviaService } from '../games/trivia/triviaService.js';
import { BonusEvent, BonusOverlayState, OverlayConnectionInfo, OverlayState, TriviaEvent, TriviaOverlayState } from './dto.js';
export class OverlayWebSocketService {
    io;
    prisma;
    connections = new Map();
    bonusService;
    triviaService;
    constructor(io, prisma) {
        this.io = io;
        this.prisma = prisma;
        this.bonusService = new BonusService(prisma);
        this.triviaService = new TriviaService(prisma);
        this.setupNamespace();
    }
    setupNamespace() {
        const overlayNamespace = this.io.of('/overlay');
        overlayNamespace.on('connection', (socket) => {
            const connectionInfo = {
                id: socket.id,
                connectedAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                userAgent: socket.handshake.headers['user-agent'],
                ip: socket.handshake.address,
            };
            this.connections.set(socket.id, connectionInfo);
            logger.info(`Overlay client connected: ${socket.id}`, {
                ip: connectionInfo.ip,
                userAgent: connectionInfo.userAgent,
                totalConnections: this.connections.size,
            });
            // Send current state immediately
            this.sendCurrentState(socket);
            // Handle client events
            socket.on('ping', () => {
                this.updateLastActivity(socket.id);
                socket.emit('pong', { timestamp: new Date().toISOString() });
            });
            socket.on('request_state', () => {
                this.updateLastActivity(socket.id);
                this.sendCurrentState(socket);
            });
            socket.on('disconnect', () => {
                this.connections.delete(socket.id);
                logger.info(`Overlay client disconnected: ${socket.id}`, {
                    totalConnections: this.connections.size,
                });
            });
            // Handle errors
            socket.on('error', (error) => {
                logger.error(`Overlay client error: ${socket.id}`, error);
            });
        });
    }
    async sendCurrentState(socket) {
        try {
            const state = await this.getCurrentOverlayState();
            socket.emit('state', state);
        }
        catch (error) {
            logger.error('Failed to send current state to overlay client:', error);
            socket.emit('error', { message: 'Failed to get current state' });
        }
    }
    updateLastActivity(socketId) {
        const connection = this.connections.get(socketId);
        if (connection) {
            connection.lastActivity = new Date().toISOString();
        }
    }
    async getCurrentOverlayState() {
        try {
            // Check for active bonus game
            const bonusGame = await this.bonusService.getCurrentGame();
            if (bonusGame) {
                return await this.getBonusOverlayState(bonusGame.id);
            }
            // Check for active trivia game
            const triviaGame = await this.triviaService.getCurrentGame();
            if (triviaGame) {
                return await this.getTriviaOverlayState(triviaGame.id);
            }
            // No active game
            return {
                gameType: null,
                gameStatus: 'IDLE',
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            logger.error('Failed to get current overlay state:', error);
            throw error;
        }
    }
    async getBonusOverlayState(gameId) {
        const gameState = await this.bonusService.getGameState(gameId);
        if (!gameState) {
            throw new Error('Game state not found');
        }
        const { game, bonuses, payouts, leaderboard } = gameState;
        const totalPayout = payouts.reduce((sum, p) => sum + p.amountX, 0);
        // Determine phase
        let phase = 'HUNT';
        if (game.status === 'OPENING') {
            phase = 'OPENING';
        }
        else if (game.status === 'CLOSED') {
            phase = 'CLOSED';
        }
        return {
            gameType: 'BONUS',
            gameStatus: game.status,
            gameId: game.id,
            bonuses: bonuses.map(b => ({
                id: b.id,
                name: b.bonusName,
                amountX: b.amountX,
                createdAt: b.createdAt.toISOString(),
            })),
            entries: game.bonusEntries.map(e => ({
                id: e.id,
                userId: e.userId,
                username: e.user.kickName || e.user.telegramUser || 'Unknown',
                guess: e.guess,
                createdAt: e.createdAt.toISOString(),
            })),
            payouts: payouts.map(p => ({
                id: p.id,
                bonusName: p.bonusName,
                amountX: p.amountX,
                createdAt: p.createdAt.toISOString(),
            })),
            leaderboard,
            totalPayout,
            phase,
            timestamp: new Date().toISOString(),
        };
    }
    async getTriviaOverlayState(gameId) {
        const gameState = await this.triviaService.getGameState(gameId);
        if (!gameState) {
            throw new Error('Game state not found');
        }
        const { game, rounds, scores, leaderboard } = gameState;
        // Get current open round
        const currentRound = rounds.find(r => r.status === 'OPEN');
        const currentRoundInfo = currentRound ? {
            id: currentRound.id,
            question: currentRound.question,
            status: currentRound.status,
            startedAt: currentRound.startedAt.toISOString(),
            endedAt: currentRound.endedAt?.toISOString(),
            timeLeft: currentRound.endedAt
                ? Math.max(0, currentRound.endedAt.getTime() - Date.now())
                : undefined,
        } : undefined;
        return {
            gameType: 'TRIVIA',
            gameStatus: game.status,
            gameId: game.id,
            currentRound: currentRoundInfo,
            scores: scores.map(s => ({
                userId: s.userId,
                username: s.user.kickName || s.user.telegramUser || 'Unknown',
                points: s.points,
                correctAnswers: 0, // TODO: Calculate from answers
                totalAnswers: 0, // TODO: Calculate from answers
                accuracy: 0, // TODO: Calculate accuracy
            })),
            leaderboard,
            totalRounds: rounds.length,
            timestamp: new Date().toISOString(),
        };
    }
    // Event broadcasting methods
    async broadcastBonusState(gameId) {
        try {
            const state = await this.getBonusOverlayState(gameId);
            const event = {
                type: 'bonus.state',
                data: state,
                timestamp: new Date().toISOString(),
            };
            this.io.of('/overlay').emit('bonus.state', event);
            logger.info('Broadcasted bonus state to overlay clients');
        }
        catch (error) {
            logger.error('Failed to broadcast bonus state:', error);
        }
    }
    async broadcastBonusFinal(gameId) {
        try {
            const state = await this.getBonusOverlayState(gameId);
            const event = {
                type: 'bonus.final',
                data: state,
                timestamp: new Date().toISOString(),
            };
            this.io.of('/overlay').emit('bonus.final', event);
            logger.info('Broadcasted bonus final results to overlay clients');
        }
        catch (error) {
            logger.error('Failed to broadcast bonus final:', error);
        }
    }
    async broadcastTriviaState(gameId) {
        try {
            const state = await this.getTriviaOverlayState(gameId);
            const event = {
                type: 'trivia.state',
                data: state,
                timestamp: new Date().toISOString(),
            };
            this.io.of('/overlay').emit('trivia.state', event);
            logger.info('Broadcasted trivia state to overlay clients');
        }
        catch (error) {
            logger.error('Failed to broadcast trivia state:', error);
        }
    }
    async broadcastTriviaScores(gameId) {
        try {
            const leaderboard = await this.triviaService.getLeaderboard(gameId);
            const event = {
                type: 'trivia.scores',
                data: leaderboard,
                timestamp: new Date().toISOString(),
            };
            this.io.of('/overlay').emit('trivia.scores', event);
            logger.info('Broadcasted trivia scores to overlay clients');
        }
        catch (error) {
            logger.error('Failed to broadcast trivia scores:', error);
        }
    }
    // Utility methods
    getConnectionCount() {
        return this.connections.size;
    }
    getConnections() {
        return Array.from(this.connections.values());
    }
    async cleanupInactiveConnections(maxInactiveMinutes = 30) {
        const cutoffTime = new Date(Date.now() - maxInactiveMinutes * 60 * 1000);
        let cleanedCount = 0;
        for (const [socketId, connection] of this.connections.entries()) {
            if (new Date(connection.lastActivity) < cutoffTime) {
                const socket = this.io.of('/overlay').sockets.get(socketId);
                if (socket) {
                    socket.disconnect(true);
                    this.connections.delete(socketId);
                    cleanedCount++;
                }
            }
        }
        if (cleanedCount > 0) {
            logger.info(`Cleaned up ${cleanedCount} inactive overlay connections`);
        }
        return cleanedCount;
    }
    // Broadcast to specific client
    async sendToClient(socketId, event, data) {
        const socket = this.io.of('/overlay').sockets.get(socketId);
        if (socket) {
            socket.emit(event, data);
            this.updateLastActivity(socketId);
        }
    }
    // Broadcast to all clients
    async broadcast(event, data) {
        this.io.of('/overlay').emit(event, {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
}
//# sourceMappingURL=ws.js.map