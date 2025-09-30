import { FastifyReply, FastifyRequest } from 'fastify';
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
    async addBonus(request, reply) {
        try {
            const { name } = request.body;
            if (!name || typeof name !== 'string') {
                return reply.status(400).send({
                    success: false,
                    error: 'Bonus name is required',
                });
            }
            const bonus = await this.bonusService.addBonus(name);
            return reply.send({
                success: true,
                data: bonus,
            });
        }
        catch (error) {
            if (error instanceof ValidationError || error instanceof GameStateError) {
                return reply.status(400).send({
                    success: false,
                    error: error.message,
                });
            }
            logger.error('Failed to add bonus:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to add bonus',
            });
        }
    }
    async recordPayout(request, reply) {
        try {
            const { name, amount } = request.body;
            if (!name || typeof name !== 'string') {
                return reply.status(400).send({
                    success: false,
                    error: 'Bonus name is required',
                });
            }
            if (typeof amount !== 'number') {
                return reply.status(400).send({
                    success: false,
                    error: 'Payout amount is required',
                });
            }
            const payout = await this.bonusService.recordPayout(name, amount);
            return reply.send({
                success: true,
                data: payout,
            });
        }
        catch (error) {
            if (error instanceof ValidationError || error instanceof GameStateError) {
                return reply.status(400).send({
                    success: false,
                    error: error.message,
                });
            }
            logger.error('Failed to record payout:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to record payout',
            });
        }
    }
    async submitGuess(request, reply) {
        try {
            const { userId, guess } = request.body;
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
            const entry = await this.bonusService.submitGuess(userId, guess);
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
            const result = await this.bonusService.closeGame();
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
    async getGameState(request, reply) {
        try {
            const { gameId } = request.params;
            const state = await this.bonusService.getGameState(gameId);
            if (!state) {
                return reply.status(404).send({
                    success: false,
                    error: 'Game not found',
                });
            }
            return reply.send({
                success: true,
                data: state,
            });
        }
        catch (error) {
            logger.error('Failed to get game state:', error);
            return reply.status(500).send({
                success: false,
                error: 'Failed to get game state',
            });
        }
    }
    async getLeaderboard(request, reply) {
        try {
            const { gameId } = request.query;
            const leaderboard = await this.bonusService.getLeaderboard(gameId);
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