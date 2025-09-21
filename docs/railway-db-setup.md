# Railway Database Setup Guide

## Problem

Your bot service is not getting the DATABASE_URL from the database service. Railway is using the old SQLite URL: `file:./dev.db`

## Solution

Manually add the DATABASE_URL to your bot service environment variables.

## Step-by-Step Instructions

### 1. Go to Railway Dashboard

- Open your Railway project dashboard
- Click on your bot service (SweetflipslivestreambotTG)

### 2. Add DATABASE_URL Variable

- Go to the "Variables" tab
- Click "New Variable"
- Add this variable:

**Option A - Private URL (Recommended):**

- **Name:** `DATABASE_URL`
- **Value:** `postgresql://postgres:jchbUGUWVyjMGnYwTChaObqSTzLAorOb@${{RAILWAY_PRIVATE_DOMAIN}}:5432/railway`

**Option B - Public URL:**

- **Name:** `DATABASE_URL`
- **Value:** `postgresql://postgres:jchbUGUWVyjMGnYwTChaObqSTzLAorOb@${{RAILWAY_TCP_PROXY_DOMAIN}}:${{RAILWAY_TCP_PROXY_PORT}}/railway`

### 3. Deploy

- Click "Deploy" to restart your service with the new environment variable

## Expected Result

After adding the DATABASE_URL variable, your bot should:

- ✅ Find the correct PostgreSQL URL
- ✅ Create database tables automatically
- ✅ Start without database errors

## Troubleshooting

If you still get errors:

1. Make sure the DATABASE_URL is exactly as shown above
2. Check that your database service is running
3. Verify the password matches: `jchbUGUWVyjMGnYwTChaObqSTzLAorOb`
