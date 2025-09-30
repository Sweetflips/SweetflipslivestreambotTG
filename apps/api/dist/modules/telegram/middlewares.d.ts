import { Context, MiddlewareFn } from 'telegraf';
import { AuthService, UserContext } from '../../auth/rbac.js';
import { RATE_LIMITS, RateLimiter } from '../../utils/rateLimit.js';
export interface TelegramContext extends Context {
    user?: UserContext;
    authService: AuthService;
    rateLimiter: RateLimiter;
}
export declare const authMiddleware: MiddlewareFn<TelegramContext>;
export declare const rateLimitMiddleware: (config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS]) => MiddlewareFn<TelegramContext>;
export declare const idempotencyMiddleware: MiddlewareFn<TelegramContext>;
export declare const commandValidationMiddleware: MiddlewareFn<TelegramContext>;
export declare const errorMiddleware: MiddlewareFn<TelegramContext>;
export declare const loggingMiddleware: MiddlewareFn<TelegramContext>;
//# sourceMappingURL=middlewares.d.ts.map