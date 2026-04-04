# Railway Database Fix Guide

## Problem

Your bot is getting this error:

```
The table `main.users` does not exist in the current database.
```

This happens because:

1. Your Prisma schema was configured for SQLite, but Railway provides PostgreSQL
2. The database tables haven't been created yet

## Solution

### Step 1: Update Prisma Schema ✅ DONE

I've already updated your `apps/api/prisma/schema.prisma` to use PostgreSQL instead of SQLite.

### Step 2: Deploy to Railway with Database Migration

You have two options:

#### Option A: Use Railway CLI (Recommended)

1. Install Railway CLI: https://docs.railway.com/guides/cli
2. Login: `railway login`
3. Link your project: `railway link`
4. Deploy with database migration:
   ```bash
   railway run npm run prisma:deploy
   ```

#### Option B: Manual Railway Dashboard

1. Go to your Railway project dashboard
2. Go to your service
3. Go to the "Variables" tab
4. Make sure you have these variables set:
   - `TELEGRAM_BOT_TOKEN=8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc`
   - `NODE_ENV=production`
   - `GOOGLE_SPREADSHEET_ID=1giec5bb4Pmjywhfn_oy3aIESJ25XHi5kDwjXyoQbglQ`
   - `GOOGLE_SHEETS_ID=1giec5bb4Pmjywhfn_oy3aIESJ25XHi5kDwjXyoQbglQ`
5. Add a new variable:
   - Name: `DATABASE_URL`
   - Value: Railway will provide this automatically when you add a PostgreSQL database
6. Add a PostgreSQL database to your project:
   - Go to your project dashboard
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will automatically set the `DATABASE_URL` variable
7. Deploy your service

### Step 3: Run Database Migration

After deployment, you need to run the database migration. You can do this by:

1. **Using Railway CLI:**

   ```bash
   railway run npm run prisma:deploy
   ```

2. **Or by adding a startup script:**
   Add this to your Railway service's start command:
   ```bash
   npm run prisma:deploy && npm start
   ```

### Step 4: Verify Database

The migration script will:

- Generate Prisma client
- Create all database tables
- Test the connection
- Seed the database (if configured)

## What I've Done

1. ✅ Updated `apps/api/prisma/schema.prisma` to use PostgreSQL
2. ✅ Created `apps/api/deploy-db.js` - a database deployment script
3. ✅ Added `prisma:deploy` script to `package.json`
4. ✅ Created this guide

## Next Steps

1. Add a PostgreSQL database to your Railway project
2. Deploy your service
3. Run the database migration using one of the methods above
4. Your bot should work without the database error

## Troubleshooting

If you still get errors:

1. Check that `DATABASE_URL` is set in Railway
2. Make sure the PostgreSQL database is running
3. Check the Railway logs for any migration errors
4. Try running the migration manually: `railway run npm run prisma:deploy`
