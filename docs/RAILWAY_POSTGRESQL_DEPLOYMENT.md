# Railway PostgreSQL Deployment Guide

## Overview

This guide covers the complete setup and deployment of the Stream Bot application on Railway with PostgreSQL integration, following all Railway best practices and deployment guidelines.

## Prerequisites

- Railway account
- PostgreSQL service on Railway
- Environment variables configured
- Application code deployed

## Railway Service Setup

### 1. Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your repository

### 2. Add PostgreSQL Service

1. In your Railway project, click "New Service"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically:
   - Create a PostgreSQL database
   - Provide `DATABASE_URL` environment variable
   - Set up SSL connections
   - Configure connection pooling

### 3. Configure Environment Variables

Set these variables in your Railway service:

#### Required Variables
```bash
TELEGRAM_BOT_TOKEN=8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc
NODE_ENV=production
GOOGLE_SPREADSHEET_ID=1giec5bb4Pmjywhfn_oy3aIESJ25XHi5kDwjXyoQbglQ
GOOGLE_SHEETS_ID=1giec5bb4Pmjywhfn_oy3aIESJ25XHi5kDwjXyoQbglQ
```

#### Optional Variables
```bash
PORT=3000
HEALTH_CHECK_ENABLED=true
AUTO_RESTART_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
MAX_RESTART_ATTEMPTS=10
RESTART_DELAY=5000
BACKOFF_MULTIPLIER=1.5
MAX_DELAY=60000
POSTGRES_SSL_MODE=require
POSTGRES_POOL_SIZE=10
POSTGRES_CONNECTION_TIMEOUT=30000
POSTGRES_IDLE_TIMEOUT=30000
JWT_SECRET=sweetflips_jwt_secret_key_32_chars_long_production
ENCRYPTION_KEY=sweetflips_encryption_key_32_chars_production
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn_here
PROMETHEUS_PORT=9090
```

**Note**: `DATABASE_URL` is automatically provided by Railway when you add a PostgreSQL service.

## Deployment Configuration

### Railway Configuration Files

#### railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && cd apps/bot && npm install && cd ../api && npm install && cd ../.. && npm run build && cd apps/api && npx prisma generate && npx prisma migrate deploy"
  },
  "deploy": {
    "startCommand": "node apps/api/railway-start.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 60,
    "healthcheckInterval": 30,
    "healthcheckRetries": 3
  }
}
```

#### nixpacks.toml
```toml
[phases.setup]
nixPkgs = ["nodejs", "npm", "curl", "postgresql"]

[phases.install]
cmds = [
  "npm install",
  "cd apps/bot && npm install",
  "cd ../api && npm install",
  "cd ../.. && npm run build"
]

[phases.build]
cmds = [
  "cd apps/api",
  "npx prisma generate",
  "npx prisma migrate deploy"
]

[start]
cmd = "node apps/api/railway-start.js"
```

## Deployment Process

### Automatic Deployment

The deployment process is fully automated:

1. **Build Phase**:
   - Install dependencies
   - Build TypeScript code
   - Generate Prisma client
   - Run database migrations

2. **Deploy Phase**:
   - Validate environment
   - Test PostgreSQL connection
   - Validate database schema
   - Perform health checks
   - Start application

### Manual Deployment Commands

```bash
# Deploy to Railway
railway deploy

# Run deployment script locally
npm run railway:deploy

# Run health check
npm run health-check

# Check deployment status
railway status
```

## Health Checks

### Health Check Endpoints

- **`/health`**: Comprehensive health check
- **`/ready`**: Readiness check
- **`/live`**: Liveness check

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful"
    },
    "application": {
      "status": "healthy",
      "message": "Application configuration valid"
    }
  }
}
```

### Health Check Configuration

Railway automatically monitors:
- Application startup
- Health check endpoint responses
- Restart policies
- Resource usage

## Database Management

### Prisma Migrations

Migrations run automatically during deployment:

```bash
# Manual migration (if needed)
railway run npx prisma migrate deploy

# Check migration status
railway run npx prisma migrate status

# Reset database (development only)
railway run npx prisma migrate reset
```

### Database Operations

```bash
# Generate Prisma client
railway run npx prisma generate

# View database in Prisma Studio
railway run npx prisma studio

# Execute raw SQL
railway run npx prisma db execute --stdin
```

## Monitoring and Logs

### Railway Dashboard

- **Deployments**: View deployment history and status
- **Logs**: Real-time application logs
- **Metrics**: CPU, memory, and network usage
- **Health**: Health check status and history

### Log Monitoring

```bash
# View logs
railway logs

# Follow logs in real-time
railway logs --follow

# Filter logs by service
railway logs --service your-service-name
```

### Health Monitoring

- Health checks run every 30 seconds
- Failed health checks trigger restarts
- Maximum 10 restart attempts
- Exponential backoff on failures

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check DATABASE_URL
   railway variables
   
   # Test connection
   railway run npx prisma db execute --stdin
   ```

2. **Migration Failed**
   ```bash
   # Check migration status
   railway run npx prisma migrate status
   
   # Reset and migrate
   railway run npx prisma migrate reset
   ```

3. **Health Check Failed**
   ```bash
   # Check health endpoint
   curl https://your-app.railway.app/health
   
   # View logs
   railway logs
   ```

4. **Application Won't Start**
   ```bash
   # Check environment variables
   railway variables
   
   # View startup logs
   railway logs --follow
   ```

### Debug Commands

```bash
# Connect to Railway shell
railway shell

# Run commands in Railway environment
railway run <command>

# Check service status
railway status

# View service details
railway service
```

## Best Practices

### Security
- ✅ Never commit secrets to version control
- ✅ Use Railway's environment variables
- ✅ Enable SSL for database connections
- ✅ Use strong passwords and secrets
- ✅ Regular security updates

### Performance
- ✅ Use connection pooling
- ✅ Optimize database queries
- ✅ Monitor resource usage
- ✅ Set appropriate timeouts
- ✅ Use caching where appropriate

### Reliability
- ✅ Implement health checks
- ✅ Use restart policies
- ✅ Monitor application logs
- ✅ Set up alerts
- ✅ Regular backups

### Deployment
- ✅ Test in staging first
- ✅ Use version control
- ✅ Automated deployments
- ✅ Rollback procedures
- ✅ Monitor deployments

## Environment-Specific Configuration

### Production
- `NODE_ENV=production`
- SSL enabled
- Health checks enabled
- Restart policies active
- Monitoring enabled

### Development
- `NODE_ENV=development`
- Debug logging
- Relaxed timeouts
- Development database

## Support and Resources

### Railway Documentation
- [Railway Docs](https://docs.railway.app/)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Railway PostgreSQL](https://docs.railway.app/databases/postgresql)

### Application Support
- Check deployment logs
- Verify environment variables
- Test database connectivity
- Monitor health checks
- Contact support with detailed logs

## Version History

- **v1.0.0**: Initial Railway deployment
- **v1.1.0**: PostgreSQL integration
- **v1.2.0**: Health checks and monitoring
- **v1.3.0**: Automated migrations
- **v1.4.0**: Enhanced error handling
- **v1.5.0**: Production optimizations
