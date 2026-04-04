import { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../../telemetry/logger.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { LinkService } from './linkService.js';

export class LinkController {
  constructor(private linkService: LinkService) {}

  async generateLinkCode(request: FastifyRequest<{ Body: { userId: string } }>, reply: FastifyReply) {
    try {
      const { userId } = request.body;

      if (!userId || typeof userId !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'User ID is required',
        });
      }

      const code = await this.linkService.generateLinkCode(userId);

      return reply.send({
        success: true,
        data: { code },
      });
    } catch (error) {
      logger.error('Failed to generate link code:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate link code',
      });
    }
  }

  async verifyLinkCode(request: FastifyRequest<{ Body: { code: string; kickName: string } }>, reply: FastifyReply) {
    try {
      const { code, kickName } = request.body;

      if (!code || typeof code !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Link code is required',
        });
      }

      if (!kickName || typeof kickName !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Kick name is required',
        });
      }

      const result = await this.linkService.verifyLinkCode(code, kickName);

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: result.error,
        });
      }

      return reply.send({
        success: true,
        data: { userId: result.userId },
      });
    } catch (error) {
      logger.error('Failed to verify link code:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to verify link code',
      });
    }
  }

  async unlinkAccount(request: FastifyRequest<{ Body: { userId: string } }>, reply: FastifyReply) {
    try {
      const { userId } = request.body;

      if (!userId || typeof userId !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'User ID is required',
        });
      }

      await this.linkService.unlinkAccount(userId);

      return reply.send({
        success: true,
        message: 'Account unlinked successfully',
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to unlink account:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to unlink account',
      });
    }
  }

  async getLinkStatus(request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) {
    try {
      const { userId } = request.params;

      const status = await this.linkService.getLinkStatus(userId);

      return reply.send({
        success: true,
        data: status,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to get link status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get link status',
      });
    }
  }

  async setCwalletHandle(request: FastifyRequest<{ Body: { userId: string; handle: string } }>, reply: FastifyReply) {
    try {
      const { userId, handle } = request.body;

      if (!userId || typeof userId !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'User ID is required',
        });
      }

      if (!handle || typeof handle !== 'string') {
        return reply.status(400).send({
          success: false,
          error: 'Cwallet handle is required',
        });
      }

      await this.linkService.setCwalletHandle(userId, handle);

      return reply.send({
        success: true,
        message: 'Cwallet handle set successfully',
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to set Cwallet handle:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to set Cwallet handle',
      });
    }
  }

  async getActiveLinkCodes(request: FastifyRequest<{ Params: { telegramId: string } }>, reply: FastifyReply) {
    try {
      const { telegramId } = request.params;

      const codes = await this.linkService.getActiveLinkCodes(telegramId);

      return reply.send({
        success: true,
        data: codes,
      });
    } catch (error) {
      logger.error('Failed to get active link codes:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get active link codes',
      });
    }
  }

  async validateLinkCode(request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) {
    try {
      const { code } = request.params;

      const validation = await this.linkService.validateLinkCode(code);

      return reply.send({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error('Failed to validate link code:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to validate link code',
      });
    }
  }

  async cleanupExpiredCodes(request: FastifyRequest, reply: FastifyReply) {
    try {
      const count = await this.linkService.cleanupExpiredCodes();

      return reply.send({
        success: true,
        data: { cleanedCount: count },
      });
    } catch (error) {
      logger.error('Failed to cleanup expired codes:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to cleanup expired codes',
      });
    }
  }
}

