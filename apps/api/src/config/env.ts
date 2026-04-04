import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  TELEGRAM_WEBHOOK_URL: z.string().url('Invalid webhook URL'),
  TELEGRAM_MOD_GROUP_ID: z.string().regex(/^-?\d+$/, 'Invalid group ID'),
  TELEGRAM_PAYOUT_GROUP_ID: z.string().regex(/^-?\d+$/, 'Invalid payout group ID'),
  TREASURER_TELEGRAM_IDS: z.string().transform((val) =>
    val.split(',').map(id => id.trim()).filter(Boolean)
  ),

  // Kick Chat Configuration
  KICK_CHANNEL_ID: z.string().min(1, 'Kick channel ID is required'),
  KICK_CHAT_WEBSOCKET_URL: z.string().url('Invalid WebSocket URL'),
  KICK_CHAT_WEBSOCKET_KEY: z.string().min(1, 'WebSocket key is required'),
  KICK_CHAT_WEBSOCKET_CLUSTER: z.string().min(1, 'WebSocket cluster is required'),

  // Database Configuration
  DATABASE_URL: z.string().url('Invalid database URL'),
  DATABASE_URL_TEST: z.string().url('Invalid test database URL').optional(),

  // Redis Configuration
  REDIS_URL: z.string().url('Invalid Redis URL'),
  REDIS_PASSWORD: z.string().optional(),

  // Cwallet Configuration
  CWALLET_API_KEY: z.string().min(1, 'Cwallet API key is required'),
  CWALLET_WEBHOOK_SECRET: z.string().min(1, 'Cwallet webhook secret is required'),
  CWALLET_BASE_URL: z.string().url('Invalid Cwallet base URL'),

  // Security Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().length(32, 'Encryption key must be exactly 32 characters'),
  RATE_LIMIT_REDIS_URL: z.string().url('Invalid rate limit Redis URL'),

  // Server Configuration
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Overlay Configuration
  OVERLAY_NAMESPACE: z.string().default('/overlay'),
  OVERLAY_CORS_ORIGIN: z.string().url('Invalid CORS origin'),

  // Game Configuration
  BONUS_HUNT_MAX_GUESS: z.string().transform(Number).pipe(z.number().min(1).max(10000)).default('1000'),
  TRIVIA_ANSWER_TIMEOUT: z.string().transform(Number).pipe(z.number().min(1000).max(300000)).default('30000'),
  LINK_CODE_EXPIRY: z.string().transform(Number).pipe(z.number().min(60000).max(3600000)).default('600000'),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  PROMETHEUS_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('9090'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export function getEnv(): Env {
  if (!env) {
    try {
      env = envSchema.parse(process.env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(
          (err) => `${err.path.join('.')}: ${err.message}`
        );
        throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
      }
      throw error;
    }
  }
  return env;
}

export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

export function isTest(): boolean {
  return getEnv().NODE_ENV === 'test';
}
