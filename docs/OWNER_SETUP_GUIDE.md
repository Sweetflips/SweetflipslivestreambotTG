# 🎯 Quick Owner Setup Guide for @sweetflipsnick

## Step 1: Set Up Environment Variables

Create `apps/api/.env` file with these values:

```env
# Required for basic functionality
TELEGRAM_BOT_TOKEN=your_actual_bot_token_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/sweetflips_bot
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key_here_32_chars_long
ENCRYPTION_KEY=your_32_character_encryption_key
PORT=3000
NODE_ENV=development

# Optional (can use defaults)
TELEGRAM_WEBHOOK_URL=http://localhost:3000/webhook/telegram
KICK_CHANNEL_ID=your_kick_channel_id
CWALLET_API_KEY=your_cwallet_api_key
```

## Step 2: Start Database Services

```bash
# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Wait a few seconds, then push database schema
cd apps/api
npx prisma db push
```

## Step 3: Set Yourself as Owner

```bash
# Go back to root directory
cd ../..

# Try to set you as owner
node setup-owner.js
```

## Step 4: Get Your Telegram ID (if needed)

If the script says you need to update your Telegram ID:

1. **Start the bot:**

   ```bash
   cd apps/api
   npm run dev
   ```

2. **Message your bot** with `/start` or `/kick`

3. **Check the console** - you'll see your Telegram ID

4. **Update your ID:**
   ```bash
   cd ../..
   node update-telegram-id.js YOUR_ACTUAL_TELEGRAM_ID
   ```

## Step 5: Verify Owner Status

```bash
node setup-owner.js
```

You should see:

```
🎉 Successfully set sweetflipsnick as OWNER!
```

## Troubleshooting

### Database Connection Issues

- Make sure PostgreSQL is running: `docker compose ps`
- Check your DATABASE_URL in `.env`
- Try: `npx prisma db push`

### Bot Token Issues

- Get your bot token from @BotFather on Telegram
- Add it to `TELEGRAM_BOT_TOKEN` in `.env`

### Redis Issues

- Make sure Redis is running: `docker compose ps`
- Check your REDIS_URL in `.env`

## After Setup

Once you're an OWNER, you can:

- Use `/setrole <telegram_id> <MOD|OWNER>` to promote others
- Use `/listusers` to see all users
- Use all admin game commands
- Access all bot functionality

## Quick Commands Reference

```bash
# Check if you're owner
node setup-owner.js

# Set someone else as MOD
node set-admin.js TELEGRAM_ID MOD

# Set someone else as OWNER
node set-admin.js TELEGRAM_ID OWNER

# List all users
node -e "const {PrismaClient} = require('@prisma/client'); const p = new PrismaClient(); p.user.findMany().then(users => { console.log('Users:'); users.forEach(u => console.log(\`- \${u.telegramUser} (\${u.telegramId}): \${u.role}\`)); p.\$disconnect(); });"
```
