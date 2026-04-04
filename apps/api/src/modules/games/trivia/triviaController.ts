import type { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../../../telemetry/logger.js';
import { GameStateError, ValidationError } from '../../../utils/errors.js';
import { TriviaService } from './triviaService.js';

export class TriviaController {
  constructor(private triviaService: TriviaService) {}

  async startGame(request: FastifyRequest, reply: FastifyReply) {
    try {
      const game = await this.triviaService.startGame();

      return reply.send({
        success: true,
        data: game,
      });
    } catch (error) {
      if (error instanceof GameStateError) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to start trivia game:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to start trivia game',
      });
    }
  }

  async createRound(request: FastifyRequest<{ Body: { question: string; answer: string } }>, reply: FastifyReply) {
    try {
      const { question, answer } = request.body;

      if (!question || typeof question !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Question is required',
        });
      }

      if (!answer || typeof answer !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Answer is required',
        });
      }

      const round = await this.triviaService.createRound(question, answer);

      return reply.send({
        success: true,
        data: round,
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof GameStateError) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to create trivia round:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create trivia round',
      });
    }
  }

  async submitAnswer(request: FastifyRequest<{ Body: { userId: string; answer: string } }>, reply: FastifyReply) {
    try {
      const { userId, answer } = request.body;

      if (!userId || typeof userId !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'User ID is required',
        });
      }

      if (!answer || typeof answer !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Answer is required',
        });
      }

      const triviaAnswer = await this.triviaService.submitAnswer(roundId, userId, answer);

      return reply.send({
        success: true,
        data: triviaAnswer,
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof GameStateError) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to submit trivia answer:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to submit trivia answer',
      });
    }
  }

  async lockRound(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await this.triviaService.lockRound();

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof GameStateError) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to lock trivia round:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to lock trivia round',
      });
    }
  }

  async stopGame(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await this.triviaService.stopGame();

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof GameStateError) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to stop trivia game:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to stop trivia game',
      });
    }
  }

  async getGameState(request: FastifyRequest<{ Params: { gameId: string } }>, reply: FastifyReply) {
    try {
      const { gameId } = request.params;

      const state = await this.triviaService.getGameState(gameId);

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
    } catch (error) {
      logger.error('Failed to get trivia game state:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get game state',
      });
    }
  }

  async getLeaderboard(request: FastifyRequest<{ Querystring: { gameId?: string } }>, reply: FastifyReply) {
    try {
      const { gameId } = request.query;

      // Method not implemented yet
      const leaderboard = [];

      return reply.send({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      logger.error('Failed to get trivia leaderboard:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get leaderboard',
      });
    }
  }

  async getCurrentGame(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Method not implemented yet
      const game = null;

      return reply.send({
        success: true,
        data: game,
      });
    } catch (error) {
      logger.error('Failed to get current trivia game:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get current game',
      });
    }
  }

  async getCurrentRound(request: FastifyRequest, reply: FastifyReply) {
    try {
      // Method requires gameId parameter
      const round = null;

      return reply.send({
        success: true,
        data: round,
      });
    } catch (error) {
      logger.error('Failed to get current trivia round:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get current round',
      });
    }
  }
}

