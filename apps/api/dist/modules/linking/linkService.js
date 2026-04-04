import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { logger } from '../../../telemetry/logger.js';
import { ConflictError, NotFoundError } from '../../../utils/errors.js';
import { getEnv } from '../../config/env.js';
const env = getEnv();
export class LinkService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async generateLinkCode(userId) {
        // Check if user already has an active link code
        const existingCode = await this.prisma.linkCode.findFirst({
            where: {
                userId,
                expiresAt: {
                    gt: new Date(),
                },
                usedAt: null,
            },
        });
        if (existingCode) {
            // Extend expiration time
            await this.prisma.linkCode.update({
                where: { id: existingCode.id },
                data: {
                    expiresAt: new Date(Date.now() + env.LINK_CODE_EXPIRY),
                },
            });
            logger.info('Link code extended', { userId, code: existingCode.code });
            return existingCode.code;
        }
        // Generate new code
        const code = randomBytes(4).toString('hex').toUpperCase();
        const expiresAt = new Date(Date.now() + env.LINK_CODE_EXPIRY);
        await this.prisma.linkCode.create({
            data: {
                userId,
                code,
                expiresAt,
            },
        });
        logger.info('Link code generated', { userId, code });
        return code;
    }
    async verifyLinkCode(code, kickName) {
        const linkCode = await this.prisma.linkCode.findUnique({
            where: { code },
            include: {
                user: true,
            },
        });
        if (!linkCode) {
            throw new NotFoundError('Invalid link code');
        }
        if (linkCode.expiresAt < new Date()) {
            throw new ConflictError('Link code has expired');
        }
        if (linkCode.usedAt) {
            throw new ConflictError('Link code has already been used');
        }
        // Mark code as used
        await this.prisma.linkCode.update({
            where: { id: linkCode.id },
            data: {
                usedAt: new Date(),
            },
        });
        // Update user with Kick name
        await this.prisma.user.update({
            where: { id: linkCode.userId },
            data: {
                kickName,
                linkedAt: new Date(),
            },
        });
        logger.info('Account linked successfully', {
            userId: linkCode.userId,
            kickName,
            code,
        });
        return true;
    }
    async unlinkAccount(userId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                kickName: null,
                linkedAt: null,
            },
        });
        // Invalidate any active link codes
        await this.prisma.linkCode.updateMany({
            where: {
                userId,
                usedAt: null,
            },
            data: {
                usedAt: new Date(),
            },
        });
        logger.info('Account unlinked', { userId });
    }
    async getLinkStatus(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                telegramId: true,
                telegramUser: true,
                kickName: true,
                cwalletHandle: true,
                linkedAt: true,
                linkCodes: {
                    where: {
                        expiresAt: {
                            gt: new Date(),
                        },
                        usedAt: null,
                    },
                    select: {
                        code: true,
                        expiresAt: true,
                    },
                },
            },
        });
        if (!user) {
            throw new NotFoundError('User not found');
        }
        return user;
    }
}
//# sourceMappingURL=linkService.js.map