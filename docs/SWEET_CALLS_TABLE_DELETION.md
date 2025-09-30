# Sweet Calls Tables Deletion Guide

## Overview

This guide covers the safe deletion of the `sweet_calls` and `sweet_calls_rounds` tables from the PostgreSQL database on Railway.

## Tables Being Deleted

- **sweet_calls**: Individual sweet call entries
- **sweet_calls_rounds**: Sweet calls round management

## Deletion Process

### 1. Schema Updates

The Prisma schema has been updated to remove:
- `SweetCallsRound` model
- `SweetCall` model
- Related relations in `User` and `AuditLog` models

### 2. Migration Generated

A Prisma migration has been created to drop the tables:
```bash
npx prisma migrate dev --name drop_sweet_calls_tables
```

### 3. Deletion Scripts

#### Local Deletion
```bash
npm run delete:sweet-calls
```

#### Railway Deletion
```bash
npm run railway:delete-tables
```

#### Railway CLI
```bash
railway run npm run delete:sweet-calls
```

## Safety Features

### Backup Creation
- Script checks for existing data before deletion
- Creates backup information (not saved to file)
- Logs all data that would be lost

### Validation Steps
1. **PostgreSQL Connection**: Validates database connection
2. **Table Existence**: Checks which tables exist
3. **Data Backup**: Captures sample data and counts
4. **Foreign Key Check**: Identifies any constraints
5. **Deletion**: Drops tables with CASCADE
6. **Validation**: Confirms tables are deleted

### Error Handling
- Comprehensive error logging
- Graceful failure handling
- Rollback information provided

## Script Features

### SweetCallsTableDeletion Class

```javascript
const deletion = new SweetCallsTableDeletion();
await deletion.run();
```

**Methods:**
- `validatePostgreSQLConnection()`: Ensures PostgreSQL connection
- `checkTablesExist()`: Lists existing tables
- `getTableData()`: Captures data before deletion
- `createBackup()`: Prepares backup information
- `deleteTable()`: Safely deletes individual tables
- `validateDeletion()`: Confirms successful deletion

## Usage Examples

### Local Development
```bash
# Run deletion script
cd apps/api
npm run delete:sweet-calls

# Or run directly
node scripts/delete-sweet-calls-tables.js
```

### Railway Production
```bash
# Using Railway CLI
railway run npm run delete:sweet-calls

# Or run the Railway-specific script
railway run npm run railway:delete-tables
```

### Manual SQL (Not Recommended)
```sql
-- Only if scripts fail
DROP TABLE IF EXISTS sweet_calls CASCADE;
DROP TABLE IF EXISTS sweet_calls_rounds CASCADE;
```

## What Gets Deleted

### sweet_calls Table
- Individual sweet call entries
- User call history
- Slot assignments
- Multiplier data

### sweet_calls_rounds Table
- Round management data
- Round phases and status
- Round timestamps
- Round relationships

## What Remains

### Preserved Tables
- `users`: User accounts and data
- `game_rounds`: Game round management
- `guesses`: User guesses
- `audit_logs`: Audit trail (sweet calls references removed)
- `telegram_groups`: Telegram group data
- `schedules`: Stream schedules
- `stream_notifications`: Notification history
- `bonus_items`: Bonus item data

### Preserved Data
- All user accounts
- Game history
- Guess data
- Audit logs (except sweet calls references)
- Telegram group information
- Stream schedules
- Notification history

## Verification Steps

### After Deletion
1. **Check Tables**: Verify tables are gone
2. **Test Application**: Ensure app still works
3. **Check Logs**: Review deletion logs
4. **Validate Schema**: Confirm Prisma schema is valid

### Commands
```bash
# Check if tables exist
npx prisma db execute --stdin
# Then run: SELECT table_name FROM information_schema.tables WHERE table_name IN ('sweet_calls', 'sweet_calls_rounds');

# Validate schema
npx prisma validate

# Generate client
npx prisma generate

# Test application
npm run dev
```

## Rollback (If Needed)

### If Deletion Fails
1. Check error logs
2. Verify database connection
3. Check foreign key constraints
4. Run deletion script again

### If Data Recovery Needed
- No automatic rollback is provided
- Backup data is logged but not saved
- Manual data restoration would be required
- Consider database backup before deletion

## Best Practices

### Before Deletion
- ✅ Test in staging environment first
- ✅ Backup database if data is important
- ✅ Verify no critical dependencies
- ✅ Check application functionality

### During Deletion
- ✅ Monitor deletion logs
- ✅ Verify each step completes
- ✅ Check for foreign key issues
- ✅ Validate PostgreSQL connection

### After Deletion
- ✅ Test application functionality
- ✅ Verify schema is valid
- ✅ Check for any remaining references
- ✅ Update application code if needed

## Troubleshooting

### Common Issues

1. **Foreign Key Constraints**
   ```bash
   # Check constraints
   npx prisma db execute --stdin
   # Run constraint query from script
   ```

2. **Connection Issues**
   ```bash
   # Test connection
   npx prisma db execute --stdin
   # Run: SELECT 1;
   ```

3. **Permission Issues**
   ```bash
   # Check database permissions
   # Ensure user has DROP TABLE privileges
   ```

### Error Messages

- **"Table does not exist"**: Tables already deleted
- **"Foreign key constraint"**: Check dependencies
- **"Permission denied"**: Check database permissions
- **"Connection failed"**: Verify DATABASE_URL

## Support

For issues with table deletion:

1. Check deletion logs for detailed error messages
2. Verify database connection and permissions
3. Check for foreign key constraints
4. Test in staging environment first
5. Contact support with detailed logs

## Version History

- **v1.0.0**: Initial table deletion implementation
- **v1.1.0**: Added backup and validation features
- **v1.2.0**: Enhanced error handling and logging
- **v1.3.0**: Railway-specific deployment scripts
