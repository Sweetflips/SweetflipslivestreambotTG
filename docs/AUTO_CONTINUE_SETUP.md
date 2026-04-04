# Auto-Continue Setup for SweetflipsStreamBot

This document explains how the auto-continue and auto-restart functionality has been configured to ensure the bot never gets stuck and automatically recovers from errors.

## 🚀 Features Implemented

### 1. **Built-in Auto-Restart in bot.js**

- **Health Monitoring**: Continuous health checks every 30 seconds
- **Automatic Recovery**: Bot automatically restarts on failures
- **Exponential Backoff**: Smart retry delays to avoid overwhelming services
- **Graceful Shutdown**: Proper cleanup before restart
- **Maximum Retry Limits**: Prevents infinite restart loops

### 2. **Process Management Options**

- **PM2**: Advanced process manager with clustering support
- **Forever**: Simple process manager for basic restart needs
- **Systemd**: Linux service management with auto-restart
- **Docker**: Container-level restart policies

### 3. **Multiple Deployment Methods**

- **Direct Node.js**: With built-in auto-restart
- **Docker Compose**: With restart policies and health checks
- **Railway**: Cloud deployment with auto-restart
- **VPS**: Systemd service with monitoring

## 📋 Configuration Files

### Core Configuration

- `auto-continue.config.js` - Main configuration file
- `ecosystem.config.js` - PM2 configuration
- `forever.json` - Forever configuration
- `railway.json` - Railway deployment config

### Docker Configuration

- `docker-compose.yml` - Development with auto-restart
- `docker-compose.prod.yml` - Production with enhanced restart policies
- `docker-compose.bot.yml` - Bot-specific Docker setup
- `Dockerfile.bot` - Optimized bot container

### Monitoring Scripts

- `monitor.sh` - Linux/macOS monitoring script
- `monitor.bat` - Windows monitoring script

## 🛠️ Usage Instructions

### Option 1: Direct Node.js (Recommended for Development)

```bash
# Start with built-in auto-restart
npm start

# Start with PM2 (Production)
npm run start:pm2

# Start with Forever
npm run start:auto
```

### Option 2: Docker (Recommended for Production)

```bash
# Development with auto-restart
docker-compose up -d

# Production with enhanced restart policies
docker-compose -f docker-compose.prod.yml up -d

# Bot-specific deployment
docker-compose -f docker-compose.bot.yml up -d
```

### Option 3: Railway (Cloud Deployment)

```bash
# Deploy to Railway with auto-restart
railway up
```

### Option 4: VPS with Systemd

```bash
# Run the deployment script
sudo ./scripts/deploy.sh

# The script automatically configures systemd with auto-restart
```

## 🔧 Environment Variables

Configure these environment variables to customize auto-restart behavior:

```bash
# Auto-restart settings
AUTO_RESTART_ENABLED=true
MAX_RESTART_ATTEMPTS=10
RESTART_DELAY=5000
BACKOFF_MULTIPLIER=1.5
MAX_DELAY=60000

# Health check settings
HEALTH_CHECK_INTERVAL=30000

# Process manager
PROCESS_MANAGER=auto  # auto, pm2, forever, systemd, docker

# Logging
LOG_LEVEL=info
```

## 📊 Monitoring and Management

### Check Bot Status

```bash
# PM2
npm run status:pm2
pm2 status

# Forever
npm run status
forever list

# Systemd
systemctl status sweetflips-bot

# Docker
docker-compose ps
```

### View Logs

```bash
# PM2
npm run logs:pm2
pm2 logs sweetflips-bot

# Forever
npm run logs
forever logs bot.js

# Systemd
journalctl -u sweetflips-bot -f

# Docker
docker-compose logs -f
```

### Manual Control

```bash
# Restart
npm run restart:pm2
pm2 restart sweetflips-bot

# Stop
npm run stop:pm2
pm2 stop sweetflips-bot

# Start
npm run start:pm2
pm2 start ecosystem.config.js
```

## 🚨 Error Recovery

The bot automatically handles these scenarios:

1. **Network Issues**: Temporary connection problems
2. **API Rate Limits**: Telegram API throttling
3. **Database Connection Loss**: Database connectivity issues
4. **Memory Issues**: Automatic restart on memory limits
5. **Unexpected Crashes**: Any unhandled exceptions

### Recovery Process

1. **Detection**: Health check fails or process crashes
2. **Graceful Shutdown**: Clean up resources and connections
3. **Wait Period**: Brief delay before restart
4. **Restart**: Launch new bot instance
5. **Verification**: Confirm bot is running properly
6. **Backoff**: Increase delay if multiple failures occur

## 📈 Performance Monitoring

The bot includes built-in monitoring for:

- **Uptime**: How long the bot has been running
- **Restart Count**: Number of restarts in current session
- **Memory Usage**: Current memory consumption
- **Error Rate**: Frequency of errors and recoveries
- **Response Times**: API response times

## 🔒 Security Considerations

- **Graceful Shutdown**: Proper cleanup of sensitive data
- **Log Rotation**: Automatic log file management
- **Resource Limits**: Memory and CPU limits to prevent abuse
- **Error Sanitization**: Sensitive data not logged

## 🆘 Troubleshooting

### Bot Keeps Restarting

1. Check logs for error patterns
2. Verify environment variables
3. Check database connectivity
4. Verify Telegram bot token

### Health Checks Failing

1. Check network connectivity
2. Verify external API endpoints
3. Check database status
4. Review resource usage

### Performance Issues

1. Monitor memory usage
2. Check CPU utilization
3. Review log file sizes
4. Optimize database queries

## 📞 Support

If you encounter issues with the auto-continue setup:

1. Check the logs first: `npm run logs:pm2`
2. Verify configuration: Review `auto-continue.config.js`
3. Test health checks: `npm run health`
4. Check system resources: Monitor CPU and memory usage

## 🎯 Best Practices

1. **Use PM2 for Production**: Most reliable process manager
2. **Monitor Logs Regularly**: Check for error patterns
3. **Set Resource Limits**: Prevent memory leaks
4. **Test Restart Scenarios**: Verify recovery works
5. **Keep Dependencies Updated**: Regular security updates
6. **Backup Configuration**: Save working configurations

---

**The bot is now configured to NEVER get stuck and will automatically continue running even after errors or crashes!** 🚀
