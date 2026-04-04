# Database Migration Scripts

## Fix Sweet Calls Table Schema

The `run-prisma-migration.js` script fixes the missing columns in the `sweet_calls_rounds` table that are causing the "column does not exist" error using proper Prisma migrations.

### Problem
The database table `sweet_calls_rounds` is missing the following columns:
- `createdAt`
- `closedAt` 
- `revealedAt`
- `updatedAt`

### Solution

#### For Railway Deployment:
The Railway deployment will automatically run the migration on startup. If you need to run it manually:

```bash
# In Railway console or local environment
node apps/api/fix-database.js
```

#### For Local Development:
```bash
cd apps/api
node scripts/ensure-database-schema.js
```

### What the script does:
1. Checks current table structure using Prisma
2. Adds missing columns using proper PostgreSQL syntax
3. Sets appropriate default values and constraints
4. Creates a trigger to automatically update the `updatedAt` column
5. Verifies the table structure after migration
6. Tests Prisma ORM access to ensure everything works

### Prisma Migration Commands
For standard Prisma migrations, use:

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations to production
npx prisma migrate deploy

# Reset database and apply all migrations
npx prisma migrate reset

# Push schema changes without creating migration files
npx prisma db push
```

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
5. Ensure you're using PostgreSQL (not SQLite) for Railway deployments
