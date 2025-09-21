module.exports = {
  apps: [{
    name: 'sweetflips-bot',
    script: 'bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      AUTO_RESTART_ENABLED: 'true',
      HEALTH_CHECK_INTERVAL: '30000',
      MAX_RESTART_ATTEMPTS: '10',
      RESTART_DELAY: '5000',
      BACKOFF_MULTIPLIER: '1.5',
      MAX_DELAY: '60000'
    },
    env_development: {
      NODE_ENV: 'development',
      AUTO_RESTART_ENABLED: 'true',
      HEALTH_CHECK_INTERVAL: '15000',
      MAX_RESTART_ATTEMPTS: '5'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 5000,
    listen_timeout: 10000,
    shutdown_with_message: true
  }]
};
