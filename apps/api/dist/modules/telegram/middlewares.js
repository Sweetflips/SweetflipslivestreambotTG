import { Context, MiddlewareFn } from 'telegraf';
import { AuthService, UserContext } from '../../auth/rbac.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../telemetry/logger.js';
import { RATE_LIMITS, RateLimiter } from '../../utils/rateLimit.js';
const env = getEnv();
// Authentication middleware
export const authMiddleware = async (ctx, next) => {
    if (!ctx.from) {
        await ctx.reply('❌ Unable to identify user');
        return;
    }
    const telegramId = ctx.from.id.toString();
    const chatId = ctx.chat?.id.toString();
    if (!chatId) {
        await ctx.reply('❌ Unable to identify chat');
        return;
    }
    try {
        const authResult = await ctx.authService.authenticateTelegramUser(telegramId, chatId, env.TELEGRAM_BOT_TOKEN);
        if (!authResult.isAuthenticated) {
            await ctx.reply('❌ Authentication failed');
            return;
        }
        ctx.user = authResult.user;
        await next();
    }
    catch (error) {
        logger.error('Authentication middleware error:', error);
        await ctx.reply('❌ Authentication error');
    }
};
// Rate limiting middleware
export const rateLimitMiddleware = (config) => {
    return async (ctx, next) => {
        if (!ctx.user) {
            await ctx.reply('❌ Authentication required');
            return;
        }
        try {
            await ctx.rateLimiter.consumeLimit(ctx.user.id, config);
            await next();
        }
        catch (error) {
            if (error.message.includes('Rate limit exceeded')) {
                await ctx.reply('⏰ Please wait before using this command again');
                return;
            }
            throw error;
        }
    };
};
// Idempotency middleware
export const idempotencyMiddleware = async (ctx, next) => {
    if (!ctx.message || !('message_id' in ctx.message)) {
        await next();
        return;
    }
    const chatId = ctx.chat?.id.toString();
    const messageId = ctx.message.message_id;
    const key = `cmd:${chatId}:${messageId}`;
    try {
        const exists = await ctx.rateLimiter.redis.exists(key);
        if (exists) {
            logger.info(`Duplicate command ignored: ${key}`);
            return;
        }
        // Set key with 5 minute TTL
        await ctx.rateLimiter.redis.setex(key, 300, '1');
        await next();
    }
    catch (error) {
        logger.error('Idempotency middleware error:', error);
        await next(); // Continue on error
    }
};
// Command validation middleware
export const commandValidationMiddleware = async (ctx, next) => {
    if (!ctx.message || !('text' in ctx.message)) {
        await next();
        return;
    }
    const text = ctx.message.text;
    // Basic validation
    if (text.length > 1000) {
        await ctx.reply('❌ Command too long');
        return;
    }
    // Check for suspicious patterns
    const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /data:/i,
    ];
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(text)) {
            await ctx.reply('❌ Invalid command format');
            return;
        }
    }
    await next();
};
// Error handling middleware
export const errorMiddleware = async (ctx, next) => {
    try {
        await next();
    }
    catch (error) {
        logger.error('Telegram command error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Don't expose internal errors to users
        const userMessage = errorMessage.includes('Rate limit')
            ? '⏰ Please wait before using this command again'
            : '❌ An error occurred. Please try again later.';
        try {
            await ctx.reply(userMessage);
        }
        catch (replyError) {
            logger.error('Failed to send error reply:', replyError);
        }
    }
};
// Logging middleware
export const loggingMiddleware = async (ctx, next) => {
    const startTime = Date.now();
    logger.info({
        type: 'telegram_command',
        userId: ctx.from?.id,
        username: ctx.from?.username,
        chatId: ctx.chat?.id,
        command: ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ')[0] : 'unknown',
    });
    await next();
    const duration = Date.now() - startTime;
    logger.info({
        type: 'telegram_command_completed',
        userId: ctx.from?.id,
        duration: `${duration}ms`,
    });
};
//# sourceMappingURL=middlewares.js.map