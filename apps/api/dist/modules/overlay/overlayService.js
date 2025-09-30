import { Server as SocketIOServer } from 'socket.io';
import { getEnv } from '../../config/env.js';
import { logger } from '../../telemetry/logger.js';
import { BonusService } from '../games/bonus/bonusService.js';
import { TriviaService } from '../games/trivia/triviaService.js';
const env = getEnv();
export class OverlayService {
    bonusService;
    triviaService;
    io;
    overlayNamespace;
    constructor(io, bonusService, triviaService) {
        this.bonusService = bonusService;
        this.triviaService = triviaService;
        this.io = io;
        this.setupOverlayNamespace();
    }
    setupOverlayNamespace() {
        this.overlayNamespace = this.io.of(env.OVERLAY_NAMESPACE);
        this.overlayNamespace.on('connection', (socket) => {
            logger.info('Overlay client connected', { socketId: socket.id });
            // Send current state when client connects
            this.sendCurrentState(socket);
            socket.on('disconnect', () => {
                logger.info('Overlay client disconnected', { socketId: socket.id });
            });
        });
    }
    async sendCurrentState(socket) {
        try {
            const state = await this.getCurrentState();
            socket.emit('state', state);
        }
        catch (error) {
            logger.error('Failed to send current state to overlay:', error);
        }
    }
    async getCurrentState() {
        try {
            // Check for active bonus hunt
            try {
                const bonusGame = await this.bonusService.getActiveGame();
                const bonusState = await this.bonusService.getGameState(bonusGame.id);
                return {
                    gameType: 'BONUS',
                    gameStatus: bonusGame.status,
                    data: {
                        gameId: bonusGame.id,
                        entries: bonusState.bonusEntries.map(entry => ({
                            username: entry.user.kickName || entry.user.telegramUser || 'Unknown',
                            guess: entry.guess,
                            timestamp: entry.createdAt,
                        })),
                        payouts: bonusState.payouts,
                        totalPayout: bonusState.totalPayout,
                    },
                };
            }
            catch (error) {
                // No active bonus game, check for trivia
            }
            // Check for active trivia game
            try {
                const triviaGame = await this.triviaService.getActiveGame();
                const triviaState = await this.triviaService.getGameState(triviaGame.id);
                return {
                    gameType: 'TRIVIA',
                    gameStatus: triviaGame.status,
                    data: {
                        gameId: triviaGame.id,
                        currentRound: triviaState.triviaRounds[0] || null,
                        scores: triviaState.scores.map(score => ({
                            username: score.user.kickName || score.user.telegramUser || 'Unknown',
                            points: score.points,
                        })),
                    },
                };
            }
            catch (error) {
                // No active trivia game
            }
            // No active games
            return {
                gameType: null,
                gameStatus: 'IDLE',
                data: null,
            };
        }
        catch (error) {
            logger.error('Failed to get current overlay state:', error);
            return {
                gameType: null,
                gameStatus: 'IDLE',
                data: null,
            };
        }
    }
    async broadcastBonusUpdate(gameId) {
        try {
            const state = await this.bonusService.getGameState(gameId);
            this.overlayNamespace.emit('bonus.state', {
                gameId,
                entries: state.bonusEntries.map(entry => ({
                    username: entry.user.kickName || entry.user.telegramUser || 'Unknown',
                    guess: entry.guess,
                    timestamp: entry.createdAt,
                })),
                payouts: state.payouts,
                totalPayout: state.totalPayout,
            });
            logger.info('Bonus update broadcasted to overlay', { gameId });
        }
        catch (error) {
            logger.error('Failed to broadcast bonus update:', error);
        }
    }
    async broadcastBonusFinal(gameId, results) {
        try {
            this.overlayNamespace.emit('bonus.final', {
                gameId,
                totalPayout: results.totalPayout,
                winners: results.entries.slice(0, 10).map((entry, index) => ({
                    position: index + 1,
                    username: entry.user.kickName || entry.user.telegramUser || 'Unknown',
                    guess: entry.guess,
                    delta: Math.abs(entry.guess - results.totalPayout),
                })),
            });
            logger.info('Bonus final results broadcasted to overlay', { gameId });
        }
        catch (error) {
            logger.error('Failed to broadcast bonus final results:', error);
        }
    }
    async broadcastTriviaUpdate(gameId) {
        try {
            const state = await this.triviaService.getGameState(gameId);
            this.overlayNamespace.emit('trivia.state', {
                gameId,
                currentRound: state.triviaRounds[0] || null,
                scores: state.scores.map(score => ({
                    username: score.user.kickName || score.user.telegramUser || 'Unknown',
                    points: score.points,
                })),
            });
            logger.info('Trivia update broadcasted to overlay', { gameId });
        }
        catch (error) {
            logger.error('Failed to broadcast trivia update:', error);
        }
    }
    async broadcastTriviaScores(gameId, scores) {
        try {
            this.overlayNamespace.emit('trivia.scores', {
                gameId,
                scores: scores.map(score => ({
                    username: score.user.kickName || score.user.telegramUser || 'Unknown',
                    points: score.points,
                })),
            });
            logger.info('Trivia scores broadcasted to overlay', { gameId });
        }
        catch (error) {
            logger.error('Failed to broadcast trivia scores:', error);
        }
    }
}
//# sourceMappingURL=overlayService.js.map