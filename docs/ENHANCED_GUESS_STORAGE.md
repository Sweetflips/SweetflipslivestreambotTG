# Enhanced Guess Storage System

## Overview

The enhanced guess storage system ensures that all user guesses are properly stored in the database until a game is officially ended. This system provides comprehensive data persistence, archiving, and lifecycle management for guess-based games.

## Key Features

### 1. Persistent Guess Storage
- All guesses are stored in the database immediately upon submission
- Guesses remain in the database throughout the entire game lifecycle
- Data is only archived (not deleted) when games are properly completed

### 2. Game Lifecycle Management
The system now supports a complete game lifecycle with the following states:

- **IDLE**: Game round created but not yet opened
- **OPEN**: Accepting guesses from users
- **CLOSED**: Guessing closed, waiting for final value
- **REVEALED**: Results revealed, game ready for completion
- **COMPLETED**: Game fully completed and archived

### 3. Data Archiving
- Completed games are archived with full data preservation
- Archive includes all guesses, user information, and game results
- Historical data can be retrieved and analyzed

### 4. Data Retention Policies
- Configurable retention periods for archived games
- Automatic cleanup of old archives
- Manual archive management commands

## Database Schema Changes

### Enhanced GameRound Model
```prisma
model GameRound {
  id          String   @id @default(cuid())
  type        String   // "BONUS", "TRIVIA", "GUESS_BALANCE", "GUESS_BONUS"
  phase       String   @default("IDLE") // "IDLE", "OPEN", "CLOSED", "REVEALED", "COMPLETED"
  finalValue  Int?
  graceWindow Int      @default(30) // seconds
  windowMin   Int      @default(0)  // minutes, 0 = manual close only
  minRange    Int      @default(1)
  maxRange    Int      @default(1000000)
  createdAt   DateTime @default(now())
  closedAt    DateTime?
  revealedAt  DateTime?
  completedAt DateTime? // When the game round is fully completed and archived
  updatedAt   DateTime @updatedAt

  // Relations
  guesses   Guess[]
  bonusItems BonusItem[]
  auditLogs AuditLog[]

  @@map("game_rounds")
}
```

### Enhanced Guess Model
```prisma
model Guess {
  id        String   @id @default(cuid())
  gameRoundId String
  userId    String
  value     Int
  createdAt DateTime @default(now())
  editedAt  DateTime?
  isArchived Boolean @default(false) // Whether this guess has been archived with a completed game

  // Relations
  gameRound GameRound @relation(fields: [gameRoundId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([gameRoundId, userId])
  @@unique([gameRoundId, value])
  @@map("guesses")
}
```

### New CompletedGameArchive Model
```prisma
model CompletedGameArchive {
  id          String   @id @default(cuid())
  originalGameRoundId String @unique // Reference to the original game round
  gameType    String   // "BONUS", "TRIVIA", "GUESS_BALANCE", "GUESS_BONUS"
  finalValue  Int?
  totalGuesses Int     @default(0)
  winnerUserId String? // ID of the winning user
  winnerGuess  Int?    // The winning guess value
  gameData    String   // JSON string containing all game data (guesses, results, etc.)
  completedAt DateTime @default(now())
  archivedAt  DateTime @default(now())

  @@map("completed_game_archives")
}
```

## New Commands

### Game Lifecycle Commands (Owner Only)

#### Complete Game
```
/game complete <bonus|balance>
```
- Completes the current game and archives all data
- Can only be used after results have been revealed
- Preserves all guesses and game data in the archive

#### Start New Game
```
/game new <bonus|balance>
```
- Creates a fresh game round
- Can only be used if current game has no guesses or is completed
- Ensures proper game separation

#### Enhanced Reset
```
/game reset <bonus|balance> CONFIRM
```
- Resets the current game but archives existing data first
- Provides data preservation even during resets
- Requires confirmation to prevent accidental data loss

### Archive Management Commands (Owner Only)

#### View Archives
```
/game archive <bonus|balance> [limit]
```
- Shows recent archived games
- Displays game statistics and winners
- Optional limit parameter (default: 10)

#### Game Statistics
```
/game stats <bonus|balance>
```
- Shows comprehensive game statistics
- Total archived games and guesses
- Recent game summaries

#### Cleanup Old Archives
```
/game cleanup <bonus|balance> [days]
```
- Removes archives older than specified days (default: 90)
- Helps manage database size
- Configurable retention period

## Data Flow

### 1. Game Creation
1. New game round created with IDLE status
2. Game configuration set (ranges, grace window, etc.)

### 2. Guessing Phase
1. Game opened for guessing (OPEN status)
2. Users submit guesses (stored immediately in database)
3. Guesses can be edited within grace window
4. All guess data persisted throughout phase

### 3. Game Completion
1. Guessing closed (CLOSED status)
2. Final value set by admin
3. Results revealed (REVEALED status)
4. Game completed and archived (COMPLETED status)

### 4. Data Archiving
1. All game data serialized to JSON
2. Archive record created with metadata
3. Guesses marked as archived
4. Original game round marked as completed

## Benefits

### 1. Data Integrity
- No data loss during game operations
- Complete audit trail of all game activities
- Atomic transactions ensure consistency

### 2. Historical Analysis
- Access to complete game history
- Statistical analysis capabilities
- Winner tracking and performance metrics

### 3. System Reliability
- Robust error handling and recovery
- Graceful handling of edge cases
- Comprehensive logging and auditing

### 4. Administrative Control
- Fine-grained control over game lifecycle
- Data retention management
- Archive cleanup and maintenance

## Migration Notes

The enhanced system is backward compatible with existing data. The migration adds new fields and tables without affecting existing functionality.

### Required Steps
1. Run database migration to add new schema fields
2. Update application code to use new commands
3. Train administrators on new game lifecycle procedures

### Data Preservation
- All existing guesses remain intact
- No data loss during migration
- Existing games continue to function normally

## Best Practices

### 1. Game Management
- Always complete games properly using `/game complete`
- Use `/game new` to start fresh games
- Archive data before major resets

### 2. Data Maintenance
- Regularly clean up old archives using `/game cleanup`
- Monitor archive size and adjust retention policies
- Review game statistics for insights

### 3. Error Handling
- Check game status before operations
- Use confirmation prompts for destructive actions
- Monitor audit logs for issues

## Troubleshooting

### Common Issues

#### Game Stuck in Wrong State
- Use `/game show` to check current status
- Use appropriate lifecycle commands to progress
- Contact system administrator if issues persist

#### Archive Not Found
- Check if game was properly completed
- Verify archive retention policies
- Use `/game stats` to check archive status

#### Data Inconsistency
- Check audit logs for error patterns
- Verify database integrity
- Restore from backup if necessary

## Future Enhancements

### Planned Features
- Automated archive cleanup scheduling
- Enhanced reporting and analytics
- Export capabilities for archived data
- Integration with external analytics tools

### Performance Optimizations
- Index optimization for large archives
- Pagination for archive queries
- Caching for frequently accessed data
