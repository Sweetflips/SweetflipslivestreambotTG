# Database Migration Scripts

## Fix Sweet Calls Table Schema

The `fix-sweet-calls-table.js` script fixes the missing columns in the `sweet_calls_rounds` table that are causing the "column does not exist" error.

### Problem
The database table `sweet_calls_rounds` is missing the following columns:
- `createdAt`
- `closedAt` 
- `revealedAt`
- `updatedAt`

### Solution
Run the migration script to add these missing columns:

```bash
cd apps/api
node scripts/fix-sweet-calls-table.js
```

### What the script does:
1. Adds missing columns to the `sweet_calls_rounds` table
2. Sets appropriate default values and constraints
3. Creates a trigger to automatically update the `updatedAt` column
4. Verifies the table structure after migration

### Manual SQL Migration
If you prefer to run the SQL manually, you can execute the contents of:
`apps/api/prisma/migrations/001_add_missing_columns_to_sweet_calls_rounds.sql`

### Verification
After running the migration, you can verify it worked by:
1. Using the `/dbhealth` command in Telegram
2. Checking the API health endpoint: `GET /api/health`
3. Testing Sweet Calls functionality

### Troubleshooting
If you encounter issues:
1. Ensure you have proper database permissions
2. Check that the `DATABASE_URL` environment variable is set correctly
3. Verify the database connection is working
4. Check the console logs for specific error messages
