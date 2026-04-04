import { PrismaClient } from '@prisma/client';
import { logger } from '../telemetry/logger.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export enum Role {
  VIEWER = 'VIEWER',
  MOD = 'MOD',
  OWNER = 'OWNER'
}

export interface UserContext {
  id: string;
  telegramId?: string;
  kickName?: string;
  role: Role;
}

export interface AuthResult {
  user: UserContext;
  isAuthenticated: boolean;
}

// Role hierarchy: OWNER > MOD > VIEWER
const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.VIEWER]: 0,
  [Role.MOD]: 1,
  [Role.OWNER]: 2,
};

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function requireRole(requiredRole: Role) {
  return (userRole: Role): void => {
    if (!hasRole(userRole, requiredRole)) {
      throw new ForbiddenError(
        `Insufficient permissions. Required: ${requiredRole}, Current: ${userRole}`
      );
    }
  };
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async getUserByTelegramId(telegramId: string): Promise<UserContext | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        select: {
          id: true,
          telegramId: true,
          kickName: true,
          role: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        telegramId: user.telegramId,
        kickName: user.kickName ?? undefined,
        role: user.role as Role,
      };
    } catch (error) {
      logger.error('Failed to get user by Telegram ID:', error);
      return null;
    }
  }

  async getUserByKickName(kickName: string): Promise<UserContext | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { kickName },
        select: {
          id: true,
          telegramId: true,
          kickName: true,
          role: true,
        },
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        telegramId: user.telegramId,
        kickName: user.kickName ?? undefined,
        role: user.role as Role,
      };
    } catch (error) {
      logger.error('Failed to get user by Kick name:', error);
      return null;
    }
  }

  async createOrUpdateUser(data: {
    telegramId?: string;
    telegramUser?: string;
    kickName?: string;
    role?: Role;
  }): Promise<UserContext> {
    try {
      if (!data.telegramId) {
        throw new Error('telegramId is required');
      }

      const user = await this.prisma.user.upsert({
        where: {
          telegramId: data.telegramId,
        },
        update: {
          telegramUser: data.telegramUser ?? null,
          kickName: data.kickName ?? null,
          role: data.role ?? undefined,
          linkedAt: data.kickName && data.telegramId ? new Date() : undefined,
        },
        create: {
          telegramId: data.telegramId,
          telegramUser: data.telegramUser ?? null,
          kickName: data.kickName ?? null,
          role: data.role || Role.VIEWER,
        },
        select: {
          id: true,
          telegramId: true,
          kickName: true,
          role: true,
        },
      });

      return {
        id: user.id,
        telegramId: user.telegramId,
        kickName: user.kickName ?? undefined,
        role: user.role as Role,
      };
    } catch (error) {
      logger.error('Failed to create or update user:', error);
      throw new Error('Failed to create or update user');
    }
  }

  async verifyTelegramAdmin(
    telegramId: string,
    chatId: string,
    botToken: string
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getChatMember`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            user_id: telegramId,
          }),
        }
      );

      if (!response.ok) {
        logger.warn(`Failed to verify Telegram admin: ${response.status}`);
        return false;
      }

      const data = await response.json();
      const status = data.result?.status;

      return status === 'administrator' || status === 'creator';
    } catch (error) {
      logger.error('Error verifying Telegram admin:', error);
      return false;
    }
  }

  async authenticateTelegramUser(
    telegramId: string,
    chatId: string,
    botToken: string
  ): Promise<AuthResult> {
    // First check if user exists in our database
    let user = await this.getUserByTelegramId(telegramId);

    if (!user) {
      // Create a new user with VIEWER role
      user = await this.createOrUpdateUser({
        telegramId,
        role: Role.VIEWER,
      });
    }

    // For mod commands, verify admin status in Telegram
    if (hasRole(user.role, Role.MOD)) {
      const isAdmin = await this.verifyTelegramAdmin(telegramId, chatId, botToken);
      if (!isAdmin) {
        logger.warn(`User ${telegramId} claims to be mod but is not admin in chat ${chatId}`);
        // Downgrade to viewer if not actually admin
        user = await this.createOrUpdateUser({
          telegramId,
          role: Role.VIEWER,
        });
      }
    }

    return {
      user,
      isAuthenticated: true,
    };
  }

  async authenticateKickUser(kickName: string): Promise<AuthResult> {
    const user = await this.getUserByKickName(kickName);

    if (!user) {
      // Create a new user with VIEWER role
      const newUser = await this.createOrUpdateUser({
        kickName,
        role: Role.VIEWER,
      });

      return {
        user: newUser,
        isAuthenticated: true,
      };
    }

    return {
      user,
      isAuthenticated: true,
    };
  }
}

// Fastify preHandler for RBAC
export function createRBACPreHandler(requiredRole: Role) {
  return async (request: any, reply: any) => {
    const user = request.user as UserContext | undefined;

    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    try {
      requireRole(requiredRole)(user.role);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw error;
      }
      throw new ForbiddenError('Insufficient permissions');
    }
  };
}

// Telegraf middleware for RBAC
export function createRBACMiddleware(requiredRole: Role) {
  return async (ctx: any, next: () => Promise<void>) => {
    const user = ctx.user as UserContext | undefined;

    if (!user) {
      await ctx.reply('❌ Authentication required');
      return;
    }

    try {
      requireRole(requiredRole)(user.role);
      await next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        await ctx.reply('❌ Insufficient permissions');
        return;
      }
      throw error;
    }
  };
}
