// Auto-Continue Configuration for SweetflipsStreamBot
// This file contains all the auto-restart and error recovery settings

module.exports = {
  // Auto-restart configuration
  autoRestart: {
    enabled: process.env.AUTO_RESTART_ENABLED === 'true' || true,
    maxRetries: parseInt(process.env.MAX_RESTART_ATTEMPTS) || 10,
    retryDelay: parseInt(process.env.RESTART_DELAY) || 5000, // 5 seconds
    backoffMultiplier: parseFloat(process.env.BACKOFF_MULTIPLIER) || 1.5,
    maxDelay: parseInt(process.env.MAX_DELAY) || 60000, // 1 minute
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 seconds
    gracefulShutdownTimeout: 10000, // 10 seconds
  },

  // Health check configuration
  healthCheck: {
    enabled: true,
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    timeout: 10000,
    retries: 3,
    endpoints: {
      database: true,
      telegram: true,
      external: false // Set to true if you want to check external APIs
    }
  },

  // Process management configuration
  processManager: {
    type: process.env.PROCESS_MANAGER || 'auto', // 'auto', 'pm2', 'forever', 'systemd', 'docker'
    options: {
      pm2: {
        instances: 1,
        maxMemoryRestart: '500M',
        minUptime: '10s',
        maxRestarts: 10,
        restartDelay: 5000
      },
      forever: {
        minUptime: '10s',
        spinSleepTime: 1000,
        max: 10,
        restartDelay: 5000
      },
      systemd: {
        restart: 'always',
        restartSec: 5,
        startLimitInterval: '60s',
        startLimitBurst: 10
      },
      docker: {
        restart: 'always',
        healthCheck: {
          interval: '30s',
          timeout: '10s',
          retries: 5,
          startPeriod: '40s'
        }
      }
    }
  },

  // Error handling configuration
  errorHandling: {
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'rate limit',
      'flood',
      'temporary',
      'network',
      'timeout'
    ],
    permanentErrors: [
      'bot was blocked',
      'chat not found',
      'bot is not a member',
      'group chat was upgraded',
      'chat is deactivated',
      'user is deactivated',
      'forbidden: bot is not a member',
      'forbidden: chat not found',
      'invalid token',
      'unauthorized'
    ],
    maxConsecutiveErrors: 5,
    errorCooldown: 30000 // 30 seconds
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: 5,
    maxSize: '10m',
    enableConsole: true,
    enableFile: true,
    logDirectory: './logs'
  },

  // Monitoring configuration
  monitoring: {
    enabled: true,
    metrics: {
      uptime: true,
      memory: true,
      cpu: true,
      restarts: true,
      errors: true
    },
    alerts: {
      enabled: false, // Set to true to enable alerts
      webhook: process.env.ALERT_WEBHOOK_URL,
      email: process.env.ALERT_EMAIL
    }
  },

  // Environment-specific overrides
  environments: {
    development: {
      autoRestart: {
        maxRetries: 5,
        retryDelay: 2000,
        healthCheckInterval: 15000
      },
      logging: {
        level: 'debug'
      }
    },
    production: {
      autoRestart: {
        maxRetries: 10,
        retryDelay: 5000,
        healthCheckInterval: 30000
      },
      logging: {
        level: 'info'
      },
      monitoring: {
        alerts: {
          enabled: true
        }
      }
    }
  }
};
