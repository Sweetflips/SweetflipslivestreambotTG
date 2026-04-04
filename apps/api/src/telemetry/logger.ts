import pino from 'pino';
import { getEnv } from '../config/env.js';

const env = getEnv();

// Create base logger
const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? ({
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        } as any)
      : undefined,
  formatters: {
    level: label => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child logger with request ID
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

// Structured logging helpers
export function logGameEvent(event: string, data: Record<string, any> = {}) {
  logger.info({
    type: 'game_event',
    event,
    ...data,
  });
}

export function logUserAction(action: string, userId: string, data: Record<string, any> = {}) {
  logger.info({
    type: 'user_action',
    action,
    userId,
    ...data,
  });
}

export function logError(error: Error, context: Record<string, any> = {}) {
  logger.error({
    type: 'error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

export function logPerformance(
  operation: string,
  duration: number,
  data: Record<string, any> = {}
) {
  logger.info({
    type: 'performance',
    operation,
    duration,
    ...data,
  });
}

export function logSecurity(event: string, data: Record<string, any> = {}) {
  logger.warn({
    type: 'security',
    event,
    ...data,
  });
}

export { logger };
