// Local Environment Configuration for SweetflipsStreamBot
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = '8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc';
const BOT_USERNAME = '@sweetflipsstreambot';

// Create local .env file
const envContent = `# Local Development Environment
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
TELEGRAM_WEBHOOK_URL=http://localhost:3000/webhook/telegram
TELEGRAM_MOD_GROUP_ID=-1001234567890
TELEGRAM_PAYOUT_GROUP_ID=-1001234567891
TREASURER_TELEGRAM_IDS=123456789,987654321

# Kick Chat Configuration (placeholder)
KICK_CHANNEL_ID=your_kick_channel_id
KICK_CHAT_WEBSOCKET_URL=wss://ws-us2.pusher.app/app/your_app_key
KICK_CHAT_WEBSOCKET_KEY=your_websocket_key
KICK_CHAT_WEBSOCKET_CLUSTER=us2

# Database Configuration
DATABASE_URL=file:./dev.db

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Cwallet Configuration (placeholder)
CWALLET_API_KEY=your_cwallet_api_key
CWALLET_WEBHOOK_SECRET=your_webhook_secret
CWALLET_BASE_URL=https://api.cwallet.com

# Security Configuration
JWT_SECRET=local_development_jwt_secret_key_here_32_chars
ENCRYPTION_KEY=local_development_encryption_key_32
RATE_LIMIT_REDIS_URL=redis://localhost:6379/1

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Overlay Configuration
OVERLAY_NAMESPACE=/overlay
OVERLAY_CORS_ORIGIN=http://localhost:3001

# Game Configuration
BONUS_HUNT_MAX_GUESS=1000
TRIVIA_ANSWER_TIMEOUT=30000
LINK_CODE_EXPIRY=600000
`;

// Write to .env file
fs.writeFileSync('.env', envContent);

console.log('✅ Local environment configured!');
console.log(`🤖 Bot Token: ${BOT_TOKEN}`);
console.log(`🌐 Webhook URL: http://localhost:3000/webhook/telegram`);
console.log('');
console.log('📋 Next steps:');
console.log('1. Restart your development server');
console.log('2. Test bot commands in Telegram');
console.log('3. Check server logs for webhook calls');

