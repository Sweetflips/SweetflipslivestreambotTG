# Auto Database Migration System for Railway

## Overview

This system provides automated database migration capabilities for Railway deployments, following best practices for PostgreSQL and Railway environments. It ensures database schema consistency and handles migration failures gracefully.

## Features

- ✅ **Automatic Migration**: Runs on every Railway deployment
- ✅ **PostgreSQL Validation**: Ensures PostgreSQL is used in production
- ✅ **Retry Logic**: Handles temporary failures with exponential backoff
- ✅ **Health Checks**: Validates schema and operations after migration
- ✅ **Rollback Support**: Safe rollback mechanisms for failed migrations
- ✅ **Comprehensive Logging**: Detailed logs for troubleshooting
- ✅ **Error Recovery**: Multiple fallback strategies

## Architecture

### Core Components

1. **DatabaseMigrator** (`scripts/auto-migrate.js`)
   - Main migration orchestrator
   - Handles Prisma migrations and schema updates
   - Includes retry logic and error handling

2. **MigrationHealthCheck** (`scripts/migration-health-check.js`)
   - Validates database schema and operations
   - Tests all critical models and operations
   - Provides detailed diagnostics

3. **MigrationRollback** (`scripts/migration-rollback.js`)
   - Safe rollback mechanisms
   - Database backup creation
   - Multiple rollback strategies

4. **RailwayDeployment** (`scripts/railway-deploy.js`)
   - Complete deployment orchestrator
   - Integrates all migration components
   - Handles application startup

## Usage

### Automatic Deployment (Railway)

The system runs automatically on Railway deployment:

```bash
# Railway automatically runs:
node apps/api/railway-start.js
```

### Manual Migration Commands

```bash
# Run auto migration
npm run migrate:auto

# Run health check
npm run migrate:health

# Run rollback
npm run migrate:rollback

# Run complete deployment
node apps/api/scripts/railway-deploy.js
```

### Railway CLI Commands

```bash
# Run migration on Railway
railway run npm run migrate:auto

# Run health check on Railway
railway run npm run migrate:health

# Run rollback on Railway
railway run npm run migrate:rollback
```

## Migration Process

### 1. Environment Validation
- Validates required environment variables
- Ensures PostgreSQL connection string
- Checks NODE_ENV and other critical settings

### 2. Database Connection Test
- Tests database connectivity
- Validates PostgreSQL provider
- Checks database version and capabilities

### 3. Prisma Client Generation
- Generates latest Prisma client
- Ensures schema synchronization
- Updates type definitions

### 4. Migration Execution
- Runs `prisma migrate deploy` for production
- Falls back to `prisma db push` if needed
- Handles migration conflicts and errors

### 5. Schema Validation
- Tests all model accessibility
- Validates table structure
- Checks required columns and constraints

### 6. Health Check
- Tests CRUD operations on all models
- Validates SweetCallsRound specifically
- Ensures all database operations work

### 7. Application Startup
- Starts the bot application
- Handles graceful shutdown signals
- Monitors application health

## Error Handling

### Retry Logic
- **Max Retries**: 3 attempts
- **Retry Delay**: 5-10 seconds with exponential backoff
- **Fallback Strategies**: Multiple migration approaches

### Rollback Mechanisms
- **Migration Rollback**: Reverts to last stable migration
- **Schema Reset**: Resets to current schema definition
- **Backup Creation**: Creates database backups before rollback

### Error Recovery
- **Connection Issues**: Retries with backoff
- **Migration Conflicts**: Attempts schema reset
- **Health Check Failures**: Triggers rollback

## Configuration

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:port/db
NODE_ENV=production
TELEGRAM_BOT_TOKEN=your_bot_token

# Optional
MIGRATION_MAX_RETRIES=3
MIGRATION_RETRY_DELAY=5000
BACKUP_ENABLED=true
```

### Railway Configuration

```json
{
  "build": {
    "buildCommand": "npm install && cd apps/bot && npm install && cd ../api && npm install && cd ../.. && npm run build && cd apps/api && npx prisma generate"
  },
  "deploy": {
    "startCommand": "node apps/api/railway-start.js",
    "healthcheckTimeout": 60,
    "healthcheckRetries": 3
  }
}
```

## Best Practices

### Database
- ✅ Always use PostgreSQL for Railway deployments
- ✅ Never use SQLite in production
- ✅ Use Prisma for all database access
- ✅ Validate schema after migrations
- ✅ Create backups before major changes

### Deployment
- ✅ Test migrations in staging first
- ✅ Monitor deployment logs
- ✅ Use health checks for validation
- ✅ Have rollback plans ready
- ✅ Document all schema changes

### Error Handling
- ✅ Implement retry logic
- ✅ Log all errors with context
- ✅ Provide clear error messages
- ✅ Have fallback strategies
- ✅ Test error scenarios

## Troubleshooting

### Common Issues

1. **Migration Timeout**
   ```bash
   # Increase timeout in railway.json
   "healthcheckTimeout": 120
   ```

2. **Connection Issues**
   ```bash
   # Check DATABASE_URL format
   echo $DATABASE_URL
   ```

3. **Schema Conflicts**
   ```bash
   # Run rollback and retry
   npm run migrate:rollback
   npm run migrate:auto
   ```

4. **Health Check Failures**
   ```bash
   # Run detailed health check
   npm run migrate:health
   ```

### Debug Commands

```bash
# Check migration status
npx prisma migrate status

# View migration history
npx prisma migrate resolve --applied migration_name

# Reset database
npx prisma migrate reset

# Generate client
npx prisma generate
```

## Monitoring

### Logs to Monitor
- Migration start/completion
- Health check results
- Error messages and stack traces
- Retry attempts and delays
- Rollback operations

### Key Metrics
- Migration success rate
- Health check pass rate
- Average migration time
- Error frequency and types
- Rollback frequency

## Security Considerations

- ✅ Never log sensitive data (passwords, tokens)
- ✅ Use environment variables for credentials
- ✅ Validate all database inputs
- ✅ Use parameterized queries
- ✅ Implement proper access controls

## Performance Optimization

- ✅ Use connection pooling
- ✅ Optimize migration queries
- ✅ Batch schema changes
- ✅ Monitor migration performance
- ✅ Use appropriate indexes

## Support

For issues with the migration system:

1. Check the logs for detailed error messages
2. Run health checks to identify problems
3. Use rollback if migration fails
4. Test in staging environment first
5. Contact support with detailed logs

## Version History

- **v1.0.0**: Initial auto-migration system
- **v1.1.0**: Added health checks and rollback
- **v1.2.0**: Enhanced error handling and retry logic
- **v1.3.0**: Railway-specific optimizations
