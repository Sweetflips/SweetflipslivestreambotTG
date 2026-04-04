# PostgreSQL Migration Guide

## Overview

This guide covers the migration from SQLite to PostgreSQL with proper snake_case column naming conventions for Railway deployments.

## Schema Changes

### Key Updates Made

1. **Datasource Provider**: Changed from `sqlite` to `postgresql`
2. **Column Mapping**: Added `@map()` annotations for snake_case columns
3. **DateTime Fields**: Ensured all DateTime fields are properly configured
4. **Model Structure**: Maintained all existing models with proper PostgreSQL conventions

### Models Updated

#### User Model
```prisma
model User {
  id          String   @id @default(cuid())
  telegramId  String   @unique @map("telegram_id")
  telegramUser String? @map("telegram_user")
  kickName    String?  @unique @map("kick_name")
  role        String   @default("VIEWER")
  linkedAt    DateTime? @map("linked_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  @@map("users")
}
```

#### SweetCallsRound Model
```prisma
model SweetCallsRound {
  id          String   @id @default(cuid())
  phase       String   @default("IDLE")
  createdAt   DateTime @default(now()) @map("created_at")
  closedAt    DateTime? @map("closed_at")
  revealedAt  DateTime? @map("revealed_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  @@map("sweet_calls_rounds")
}
```

#### SweetCall Model
```prisma
model SweetCall {
  id        String   @id @default(cuid())
  roundId   String   @map("round_id")
  userId    String   @map("user_id")
  slotName  String   @map("slot_name")
  multiplier Float?
  createdAt DateTime @default(now()) @map("created_at")
  isArchived Boolean @default(false) @map("is_archived")
  
  @@map("sweet_calls")
}
```

## Migration Process

### 1. Schema Update
- Updated `schema.prisma` to use PostgreSQL provider
- Added `@map()` annotations for all camelCase fields
- Ensured proper DateTime field configurations

### 2. Migration Generation
```bash
# Generate migration
npx prisma migrate dev --name update_schema_for_postgresql_snake_case

# Generate Prisma client
npx prisma generate
```

### 3. Railway Deployment
The migration runs automatically on Railway deployment through:
- `railway-start.js` → `auto-migrate.js` → `postgresql-migration.js`

## Column Mapping Reference

| Prisma Field | PostgreSQL Column | Model |
|--------------|-------------------|-------|
| `telegramId` | `telegram_id` | User |
| `telegramUser` | `telegram_user` | User |
| `kickName` | `kick_name` | User |
| `linkedAt` | `linked_at` | User |
| `createdAt` | `created_at` | All models |
| `updatedAt` | `updated_at` | All models |
| `gameRoundId` | `game_round_id` | Guess, BonusItem, AuditLog |
| `userId` | `user_id` | Guess, SweetCall, AuditLog |
| `finalValue` | `final_value` | GameRound |
| `graceWindow` | `grace_window` | GameRound |
| `windowMin` | `window_min` | GameRound |
| `minRange` | `min_range` | GameRound |
| `maxRange` | `max_range` | GameRound |
| `closedAt` | `closed_at` | GameRound, SweetCallsRound |
| `revealedAt` | `revealed_at` | GameRound, SweetCallsRound |
| `editedAt` | `edited_at` | Guess |
| `isArchived` | `is_archived` | Guess, SweetCall |
| `payoutX` | `payout_x` | BonusItem |
| `sweetCallsRoundId` | `sweet_calls_round_id` | AuditLog |
| `groupId` | `group_id` | TelegramGroup |
| `memberCount` | `member_count` | TelegramGroup |
| `isActive` | `is_active` | TelegramGroup, Schedule |
| `lastSeen` | `last_seen` | TelegramGroup |
| `dayOfWeek` | `day_of_week` | Schedule, StreamNotification |
| `streamNumber` | `stream_number` | Schedule, StreamNotification |
| `eventTitle` | `event_title` | Schedule |
| `createdBy` | `created_by` | Schedule |
| `notificationType` | `notification_type` | StreamNotification |
| `sentAt` | `sent_at` | StreamNotification |
| `eventDate` | `event_date` | StreamNotification |
| `successCount` | `success_count` | StreamNotification |
| `failedCount` | `failed_count` | StreamNotification |
| `roundId` | `round_id` | SweetCall |
| `slotName` | `slot_name` | SweetCall |

## Migration Scripts

### Available Commands

```bash
# Run PostgreSQL migration
npm run migrate:postgresql

# Run auto migration (includes PostgreSQL migration)
npm run migrate:auto

# Run health check
npm run migrate:health

# Run rollback if needed
npm run migrate:rollback
```

### Railway CLI Commands

```bash
# Run migration on Railway
railway run npm run migrate:postgresql

# Run health check on Railway
railway run npm run migrate:health
```

## Best Practices

### Database Design
- ✅ Use snake_case for PostgreSQL column names
- ✅ Use camelCase for Prisma field names
- ✅ Map fields using `@map()` annotations
- ✅ Use proper DateTime types with defaults
- ✅ Include `created_at` and `updated_at` timestamps

### Migration Safety
- ✅ Always backup before migration
- ✅ Test migrations in staging first
- ✅ Use `prisma migrate deploy` for production
- ✅ Validate schema after migration
- ✅ Run health checks after deployment

### Railway Deployment
- ✅ Use PostgreSQL for all Railway deployments
- ✅ Never use SQLite in production
- ✅ Run migrations automatically on deployment
- ✅ Monitor migration logs
- ✅ Have rollback plans ready

## Troubleshooting

### Common Issues

1. **Column Not Found Errors**
   ```bash
   # Check if migration was applied
   npx prisma migrate status
   
   # Regenerate client
   npx prisma generate
   ```

2. **Migration Conflicts**
   ```bash
   # Reset and migrate
   npx prisma migrate reset
   npx prisma migrate deploy
   ```

3. **Column Naming Issues**
   ```bash
   # Check column names in database
   npx prisma db pull
   
   # Compare with schema
   npx prisma validate
   ```

### Debug Commands

```bash
# Check database connection
npx prisma db execute --stdin

# View current schema
npx prisma db pull

# Validate schema
npx prisma validate

# Check migration status
npx prisma migrate status

# View migration history
npx prisma migrate resolve --applied migration_name
```

## Validation Checklist

- [ ] PostgreSQL provider configured
- [ ] All camelCase fields have `@map()` annotations
- [ ] DateTime fields properly configured
- [ ] Migration generated successfully
- [ ] Prisma client generated
- [ ] Health checks pass
- [ ] All CRUD operations work
- [ ] SweetCallsRound operations work
- [ ] Railway deployment successful

## Support

For issues with PostgreSQL migration:

1. Check migration logs for detailed error messages
2. Run health checks to identify problems
3. Use rollback if migration fails
4. Test in staging environment first
5. Contact support with detailed logs

## Version History

- **v1.0.0**: Initial PostgreSQL migration
- **v1.1.0**: Added snake_case column mapping
- **v1.2.0**: Enhanced migration scripts
- **v1.3.0**: Railway integration improvements
