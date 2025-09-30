import Redis from 'ioredis';
import { logger } from '../telemetry/logger.js';
import { RateLimitError } from './errors.js';
export class RateLimiter {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async checkLimit(identifier, config) {
        const key = config.keyGenerator
            ? config.keyGenerator(identifier)
            : `rate_limit:${identifier}`;
        const now = Date.now();
        const windowStart = now - config.windowMs;
        try {
            // Use Redis pipeline for atomic operations
            const pipeline = this.redis.pipeline();
            // Remove expired entries
            pipeline.zremrangebyscore(key, 0, windowStart);
            // Count current requests
            pipeline.zcard(key);
            // Add current request
            pipeline.zadd(key, now, `${now}-${Math.random()}`);
            // Set expiration
            pipeline.expire(key, Math.ceil(config.windowMs / 1000));
            const results = await pipeline.exec();
            if (!results) {
                throw new Error('Redis pipeline execution failed');
            }
            const currentCount = results[1][1];
            const allowed = currentCount < config.maxRequests;
            const remaining = Math.max(0, config.maxRequests - currentCount - 1);
            const resetTime = now + config.windowMs;
            if (!allowed) {
                logger.warn({
                    type: 'rate_limit_exceeded',
                    identifier,
                    currentCount,
                    maxRequests: config.maxRequests,
                    windowMs: config.windowMs,
                });
            }
            return { allowed, remaining, resetTime };
        }
        catch (error) {
            logger.error('Rate limit check failed:', error);
            // Fail open - allow request if Redis is down
            return { allowed: true, remaining: config.maxRequests, resetTime: now + config.windowMs };
        }
    }
    async consumeLimit(identifier, config) {
        const result = await this.checkLimit(identifier, config);
        if (!result.allowed) {
            throw new RateLimitError(`Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`);
        }
    }
}
// Predefined rate limit configurations
export const RATE_LIMITS = {
    // Mod commands - 1 per 2 seconds
    MOD_COMMAND: {
        windowMs: 2000,
        maxRequests: 1,
        keyGenerator: (id) => `rate_limit:mod_command:${id}`,
    },
    // Viewer commands - 1 per 3 seconds
    VIEWER_COMMAND: {
        windowMs: 3000,
        maxRequests: 1,
        keyGenerator: (id) => `rate_limit:viewer_command:${id}`,
    },
    // Guess submissions - 1 per 5 seconds
    GUESS_SUBMISSION: {
        windowMs: 5000,
        maxRequests: 1,
        keyGenerator: (id) => `rate_limit:guess:${id}`,
    },
    // Trivia answers - 1 per 2 seconds
    TRIVIA_ANSWER: {
        windowMs: 2000,
        maxRequests: 1,
        keyGenerator: (id) => `rate_limit:trivia:${id}`,
    },
    // Link attempts - 3 per minute
    LINK_ATTEMPT: {
        windowMs: 60000,
        maxRequests: 3,
        keyGenerator: (id) => `rate_limit:link:${id}`,
    },
    // API endpoints - 100 per minute
    API_ENDPOINT: {
        windowMs: 60000,
        maxRequests: 100,
        keyGenerator: (id) => `rate_limit:api:${id}`,
    },
};
//# sourceMappingURL=rateLimit.js.map