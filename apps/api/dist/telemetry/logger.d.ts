import pino from 'pino';
declare const logger: import("pino").Logger<never>;
export declare function createRequestLogger(requestId: string): pino.Logger<never>;
export declare function logGameEvent(event: string, data?: Record<string, any>): void;
export declare function logUserAction(action: string, userId: string, data?: Record<string, any>): void;
export declare function logError(error: Error, context?: Record<string, any>): void;
export declare function logPerformance(operation: string, duration: number, data?: Record<string, any>): void;
export declare function logSecurity(event: string, data?: Record<string, any>): void;
export { logger };
//# sourceMappingURL=logger.d.ts.map