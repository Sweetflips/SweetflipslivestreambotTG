import Redis from 'ioredis';
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (identifier: string) => string;
}
export declare class RateLimiter {
    private redis;
    constructor(redis: Redis);
    checkLimit(identifier: string, config: RateLimitConfig): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
    }>;
    consumeLimit(identifier: string, config: RateLimitConfig): Promise<void>;
}
export declare const RATE_LIMITS: {
    readonly MOD_COMMAND: {
        readonly windowMs: 2000;
        readonly maxRequests: 1;
        readonly keyGenerator: (id: string) => string;
    };
    readonly VIEWER_COMMAND: {
        readonly windowMs: 3000;
        readonly maxRequests: 1;
        readonly keyGenerator: (id: string) => string;
    };
    readonly GUESS_SUBMISSION: {
        readonly windowMs: 5000;
        readonly maxRequests: 1;
        readonly keyGenerator: (id: string) => string;
    };
    readonly TRIVIA_ANSWER: {
        readonly windowMs: 2000;
        readonly maxRequests: 1;
        readonly keyGenerator: (id: string) => string;
    };
    readonly LINK_ATTEMPT: {
        readonly windowMs: 60000;
        readonly maxRequests: 3;
        readonly keyGenerator: (id: string) => string;
    };
    readonly API_ENDPOINT: {
        readonly windowMs: 60000;
        readonly maxRequests: 100;
        readonly keyGenerator: (id: string) => string;
    };
};
//# sourceMappingURL=rateLimit.d.ts.map