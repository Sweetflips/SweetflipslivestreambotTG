import { PrismaClient } from '@prisma/client';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { logger } from '../../telemetry/logger.js';
import { BonusService } from '../games/bonus/bonusService.js';
import { TriviaService } from '../games/trivia/triviaService.js';
import {
    BonusEvent,
    BonusOverlayState,
    OverlayConnectionInfo,
    OverlayState,
    TriviaEvent,
    TriviaOverlayState
} from './dto.js';

export class OverlayWebSocketService {
  private connections = new Map<string, OverlayConnectionInfo>();
  private bonusService: BonusService;
  private triviaService: TriviaService;

  constructor(
    private io: SocketIOServer,
    private prisma: PrismaClient
  ) {
    this.bonusService = new BonusService(prisma);
    this.triviaService = new TriviaService(prisma);
    this.setupNamespace();
  }

  private setupNamespace() {
    const overlayNamespace = this.io.of('/overlay');

    overlayNamespace.on('connection', (socket: Socket) => {
      const connectionInfo: OverlayConnectionInfo = {
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

  private async sendCurrentState(socket: Socket) {
    try {
      const state = await this.getCurrentOverlayState();
      socket.emit('state', state);
    } catch (error) {
      logger.error('Failed to send current state to overlay client:', error);
      socket.emit('error', { message: 'Failed to get current state' });
    }
  }

  private updateLastActivity(socketId: string) {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastActivity = new Date().toISOString();
    }
  }

  async getCurrentOverlayState(): Promise<OverlayState> {
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
    } catch (error) {
      logger.error('Failed to get current overlay state:', error);
      throw error;
    }
  }

  private async getBonusOverlayState(gameId: string): Promise<BonusOverlayState> {
    const gameState = await this.bonusService.getGameState(gameId);
    if (!gameState) {
      throw new Error('Game state not found');
    }

    const { game, bonuses, payouts, leaderboard } = gameState;
    const totalPayout = payouts.reduce((sum, p) => sum + p.amountX, 0);

    // Determine phase
    let phase: 'HUNT' | 'OPENING' | 'CLOSED' = 'HUNT';
    if (game.status === 'OPENING') {
      phase = 'OPENING';
    } else if (game.status === 'CLOSED') {
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

  private async getTriviaOverlayState(gameId: string): Promise<TriviaOverlayState> {
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
  async broadcastBonusState(gameId: string) {
    try {
      const state = await this.getBonusOverlayState(gameId);
      const event: BonusEvent = {
        type: 'bonus.state',
        data: state,
        timestamp: new Date().toISOString(),
      };

      this.io.of('/overlay').emit('bonus.state', event);
      logger.info('Broadcasted bonus state to overlay clients');
    } catch (error) {
      logger.error('Failed to broadcast bonus state:', error);
    }
  }

  async broadcastBonusFinal(gameId: string) {
    try {
      const state = await this.getBonusOverlayState(gameId);
      const event: BonusEvent = {
        type: 'bonus.final',
        data: state,
        timestamp: new Date().toISOString(),
      };

      this.io.of('/overlay').emit('bonus.final', event);
      logger.info('Broadcasted bonus final results to overlay clients');
    } catch (error) {
      logger.error('Failed to broadcast bonus final:', error);
    }
  }

  async broadcastTriviaState(gameId: string) {
    try {
      const state = await this.getTriviaOverlayState(gameId);
      const event: TriviaEvent = {
        type: 'trivia.state',
        data: state,
        timestamp: new Date().toISOString(),
      };

      this.io.of('/overlay').emit('trivia.state', event);
      logger.info('Broadcasted trivia state to overlay clients');
    } catch (error) {
      logger.error('Failed to broadcast trivia state:', error);
    }
  }

  async broadcastTriviaScores(gameId: string) {
    try {
      const leaderboard = await this.triviaService.getLeaderboard(gameId);
      const event: TriviaEvent = {
        type: 'trivia.scores',
        data: leaderboard,
        timestamp: new Date().toISOString(),
      };

      this.io.of('/overlay').emit('trivia.scores', event);
      logger.info('Broadcasted trivia scores to overlay clients');
    } catch (error) {
      logger.error('Failed to broadcast trivia scores:', error);
    }
  }

  // Utility methods
  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnections(): OverlayConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  async cleanupInactiveConnections(maxInactiveMinutes: number = 30): Promise<number> {
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
  async sendToClient(socketId: string, event: string, data: any) {
    const socket = this.io.of('/overlay').sockets.get(socketId);
    if (socket) {
      socket.emit(event, data);
      this.updateLastActivity(socketId);
    }
  }

  // Broadcast to all clients
  async broadcast(event: string, data: any) {
    this.io.of('/overlay').emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}

