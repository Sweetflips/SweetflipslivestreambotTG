import { logger } from '../../../telemetry/logger.js';
import { GameStateError, ValidationError } from '../../../utils/errors.js';
import { BonusService } from './bonusService.js';
export class BonusController {
    bonusService;
    constructor(bonusService) {
        this.bonusService = bonusService;
    }
    async startGame(request, reply) {
        try {
            const game = await this.bonusService.startGame();
            return reply.send({
                success: true,
                data: game,
            });
        }
        catch (error) {
            if (error instanceof GameStateError) {
                return reply.status(400).send({
                    success: false,
                    error: error.message,
                });
            }
            logger.error('Failed to start bonus game:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to start bonus game',
            });
        }
    }
    async submitGuess(request, reply) {
        try {
            const { gameRoundId, userId, guess } = request.body;
            if (!gameRoundId || typeof gameRoundId !== 'string') {
                return reply.status(400).send({
                    success: false,
                    error: 'Game round ID is required',
                });
            }
            if (!userId || typeof userId !== 'string') {
                return reply.status(400).send({
                    success: false,
                    error: 'User ID is required',
                });
            }
            if (typeof guess !== 'number') {
                return reply.status(400).send({
                    success: false,
                    error: 'Guess is required',
                });
            }
            const entry = await this.bonusService.submitGuess(gameRoundId, userId, guess);
            return reply.send({
                success: true,
                data: entry,
            });
        }
        catch (error) {
            if (error instanceof ValidationError || error instanceof GameStateError) {
                return reply.status(400).send({
                    success: false,
                    error: error.message,
                });
            }
            logger.error('Failed to submit guess:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to submit guess',
            });
        }
    }
    async closeGame(request, reply) {
        try {
            const { gameRoundId } = request.params;
            const result = await this.bonusService.closeGame(gameRoundId);
            return reply.send({
                success: true,
                data: result,
            });
        }
        catch (error) {
            if (error instanceof GameStateError) {
                return reply.status(400).send({
                    success: false,
                    error: error.message,
                });
            }
            logger.error('Failed to close bonus game:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to close bonus game',
            });
        }
    }
    async revealGame(request, reply) {
        try {
            const { gameRoundId } = request.params;
            const { finalValue } = request.body;
            if (typeof finalValue !== 'number') {
                return reply.status(400).send({
                    success: false,
                    error: 'Final value is required',
                });
            }
            const result = await this.bonusService.revealGame(gameRoundId, finalValue);
            return reply.send({
                success: true,
                data: result,
            });
        }
        catch (error) {
            if (error instanceof GameStateError) {
                return reply.status(400).send({
                    success: false,
                    error: error.message,
                });
            }
            logger.error('Failed to reveal bonus game:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to reveal bonus game',
            });
        }
    }
    async getGameResults(request, reply) {
        try {
            const { gameRoundId } = request.params;
            const results = await this.bonusService.getGameResults(gameRoundId);
            return reply.send({
                success: true,
                data: results,
            });
        }
        catch (error) {
            if (error instanceof GameStateError) {
                return reply.status(400).send({
                    success: false,
                    error: error.message,
                });
            }
            logger.error('Failed to get game results:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to get game results',
            });
        }
    }
    async getLeaderboard(request, reply) {
        try {
            const { gameRoundId } = request.params;
            const leaderboard = await this.bonusService.getLeaderboard(gameRoundId);
            return reply.send({
                success: true,
                data: leaderboard,
            });
        }
        catch (error) {
            logger.error('Failed to get leaderboard:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to get leaderboard',
            });
        }
    }
    async getCurrentGame(request, reply) {
        try {
            const game = await this.bonusService.getCurrentGame();
            return reply.send({
                success: true,
                data: game,
            });
        }
        catch (error) {
            logger.error('Failed to get current game:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to get current game',
            });
        }
    }
}
//# sourceMappingURL=bonusController.js.map