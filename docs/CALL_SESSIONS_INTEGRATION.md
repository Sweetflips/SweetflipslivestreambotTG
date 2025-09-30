# Call Sessions Integration Guide

## Overview

This guide covers the new Call Sessions integration that replaces the previous Sweet Calls functionality with improved table structure and naming conventions.

## New Table Structure

### CallSession Table (`call_sessions`)

The `CallSession` model represents a session where users can make calls for different slots.

```prisma
model CallSession {
  id          String   @id @default(cuid())
  sessionName String   @map("session_name")
  status      String   @default("IDLE") // "IDLE", "OPEN", "CLOSED", "REVEALED"
  createdAt   DateTime @default(now()) @map("created_at")
  closedAt    DateTime? @map("closed_at")
  revealedAt  DateTime? @map("revealed_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  callEntries CallEntry[]
  auditLogs   AuditLog[]

  @@map("call_sessions")
}
```

### CallEntry Table (`call_entries`)

The `CallEntry` model represents individual call entries made by users during a session.

```prisma
model CallEntry {
  id        String   @id @default(cuid())
  sessionId String   @map("session_id")
  userId    String   @map("user_id")
  slotName  String   @map("slot_name")
  multiplier Float?  // Outcome multiplier for this slot (set by MOD/Owner)
  createdAt DateTime @default(now()) @map("created_at")
  isArchived Boolean @default(false) @map("is_archived")

  // Relations
  session   CallSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([sessionId, userId]) // Each user can only call once per session
  @@unique([sessionId, slotName]) // Each slot can only be called once per session
  @@map("call_entries")
}
```

## Key Differences from Previous Implementation

### Table Names
- **Old**: `sweet_calls_rounds` → **New**: `call_sessions`
- **Old**: `sweet_calls` → **New**: `call_entries`

### Field Names
- **Old**: `phase` → **New**: `status`
- **Old**: `roundId` → **New**: `sessionId`
- **New**: `sessionName` (additional field for better identification)

### Relationships
- **CallSession** ↔ **CallEntry**: One-to-many relationship
- **User** ↔ **CallEntry**: One-to-many relationship
- **CallSession** ↔ **AuditLog**: One-to-many relationship

## Service Implementation

### CallSessionService

The `CallSessionService` provides all the functionality for managing call sessions and entries.

#### Key Functions

```typescript
// Create a new call session
createNewCallSession(prisma: PrismaClient): Promise<CallSessionData | null>

// Get the currently active call session
getActiveCallSession(prisma: PrismaClient): Promise<CallSessionData | null>

// Make a call entry for a user
makeCallEntry(prisma: PrismaClient, userId: string, slotName: string): Promise<{success: boolean, message: string}>

// Get all call entries for a session
getSessionCallEntries(prisma: PrismaClient, sessionId?: string): Promise<CallEntryData[]>

// Close a call session
closeCallSession(prisma: PrismaClient, sessionId?: string): Promise<boolean>

// Reveal a call session
revealCallSession(prisma: PrismaClient, sessionId?: string): Promise<boolean>

// Set multiplier for a slot
setSlotMultiplier(prisma: PrismaClient, sessionId: string, slotName: string, multiplier: number): Promise<boolean>
```

## Database Schema

### Column Mapping

| Prisma Field | PostgreSQL Column | Description |
|--------------|-------------------|-------------|
| `id` | `id` | Primary key |
| `sessionName` | `session_name` | Name of the session |
| `status` | `status` | Session status (IDLE, OPEN, CLOSED, REVEALED) |
| `createdAt` | `created_at` | When the session was created |
| `closedAt` | `closed_at` | When the session was closed |
| `revealedAt` | `revealed_at` | When the session was revealed |
| `updatedAt` | `updated_at` | When the session was last updated |
| `sessionId` | `session_id` | Foreign key to call_sessions |
| `userId` | `user_id` | Foreign key to users |
| `slotName` | `slot_name` | Name of the slot being called |
| `multiplier` | `multiplier` | Outcome multiplier for the slot |
| `isArchived` | `is_archived` | Whether the entry is archived |

### Constraints

1. **Unique Constraints**:
   - Each user can only have one entry per session
   - Each slot can only be called once per session

2. **Foreign Key Constraints**:
   - `sessionId` references `call_sessions.id`
   - `userId` references `users.id`

3. **Cascade Deletes**:
   - Deleting a session deletes all its entries
   - Deleting a user deletes all their entries

## Usage Examples

### Creating a New Session

```typescript
import { createNewCallSession } from './services/callSessionService';

const newSession = await createNewCallSession(prisma);
if (newSession) {
  console.log(`Created session: ${newSession.sessionName}`);
}
```

### Making a Call Entry

```typescript
import { makeCallEntry } from './services/callSessionService';

const result = await makeCallEntry(prisma, userId, 'slot1');
if (result.success) {
  console.log(result.message);
} else {
  console.error(result.message);
}
```

### Getting Session Entries

```typescript
import { getSessionCallEntries } from './services/callSessionService';

const entries = await getSessionCallEntries(prisma, sessionId);
console.log(`Found ${entries.length} entries`);
```

### Closing a Session

```typescript
import { closeCallSession } from './services/callSessionService';

const closed = await closeCallSession(prisma, sessionId);
if (closed) {
  console.log('Session closed successfully');
}
```

## Testing

### Test Script

Run the test script to validate all functionality:

```bash
npm run test:call-sessions
```

### Test Coverage

The test script covers:
- Database connection
- Model CRUD operations
- Relationship validation
- Constraint testing
- Error handling

### Manual Testing

```bash
# Test database connection
npx prisma db execute --stdin
# Run: SELECT 1;

# Test model creation
npx prisma studio

# Check migration status
npx prisma migrate status
```

## Migration from Old System

### Data Migration

If you have existing data in the old `sweet_calls` and `sweet_calls_rounds` tables:

1. **Export existing data**:
   ```sql
   SELECT * FROM sweet_calls_rounds;
   SELECT * FROM sweet_calls;
   ```

2. **Transform data**:
   - `sweet_calls_rounds` → `call_sessions`
   - `sweet_calls` → `call_entries`
   - `phase` → `status`
   - `roundId` → `sessionId`

3. **Import to new tables**:
   ```sql
   INSERT INTO call_sessions (id, session_name, status, created_at, closed_at, revealed_at, updated_at)
   SELECT id, 'Session_' || id, phase, created_at, closed_at, revealed_at, updated_at
   FROM sweet_calls_rounds;
   
   INSERT INTO call_entries (id, session_id, user_id, slot_name, multiplier, created_at, is_archived)
   SELECT id, round_id, user_id, slot_name, multiplier, created_at, is_archived
   FROM sweet_calls;
   ```

### Code Migration

1. **Update imports**:
   ```typescript
   // Old
   import { SweetCallsService } from './sweetCallsService';
   
   // New
   import { CallSessionService } from './callSessionService';
   ```

2. **Update function calls**:
   ```typescript
   // Old
   const round = await getActiveSweetCallsRound(prisma);
   
   // New
   const session = await getActiveCallSession(prisma);
   ```

## Best Practices

### Database Design
- ✅ Use snake_case for PostgreSQL column names
- ✅ Use camelCase for Prisma field names
- ✅ Include proper indexes for performance
- ✅ Use appropriate data types
- ✅ Implement proper constraints

### Application Code
- ✅ Use TypeScript interfaces for type safety
- ✅ Implement proper error handling
- ✅ Use Prisma for all database operations
- ✅ Validate input data
- ✅ Handle edge cases

### Performance
- ✅ Use connection pooling
- ✅ Implement proper indexing
- ✅ Optimize queries
- ✅ Use transactions for related operations
- ✅ Monitor query performance

## Troubleshooting

### Common Issues

1. **Migration Failed**
   ```bash
   # Check migration status
   npx prisma migrate status
   
   # Reset and migrate
   npx prisma migrate reset
   ```

2. **Constraint Violations**
   ```bash
   # Check unique constraints
   npx prisma studio
   
   # Verify data integrity
   npm run test:call-sessions
   ```

3. **Relationship Issues**
   ```bash
   # Check foreign key constraints
   npx prisma db execute --stdin
   # Run constraint queries
   ```

### Debug Commands

```bash
# Check table structure
npx prisma db pull

# Validate schema
npx prisma validate

# Generate client
npx prisma generate

# View data
npx prisma studio
```

## Support

For issues with Call Sessions integration:

1. Check the test results: `npm run test:call-sessions`
2. Verify database schema: `npx prisma validate`
3. Check migration status: `npx prisma migrate status`
4. Review application logs
5. Contact support with detailed error messages

## Version History

- **v1.0.0**: Initial Call Sessions implementation
- **v1.1.0**: Added comprehensive testing
- **v1.2.0**: Enhanced error handling
- **v1.3.0**: Performance optimizations
