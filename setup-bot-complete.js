const fs = require("fs");
const path = require("path");

// Bot token you provided
const BOT_TOKEN = "8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc";

console.log("🚀 Setting up SweetflipsStreamBot...\n");

// Step 1: Update .env file with bot token
const envPath = path.join(__dirname, "apps", "api", ".env");

try {
  let envContent = fs.readFileSync(envPath, "utf8");

  // Replace the bot token
  envContent = envContent.replace(
    "TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here",
    `TELEGRAM_BOT_TOKEN=${BOT_TOKEN}`
  );

  // Also set up basic database URL for local development
  envContent = envContent.replace(
    "DATABASE_URL=postgresql://username:password@localhost:5432/sweetflips_bot",
    "DATABASE_URL=postgresql://postgres:password@localhost:5432/sweetflips_bot"
  );

  // Set up Redis URL
  envContent = envContent.replace(
    "REDIS_URL=redis://localhost:6379",
    "REDIS_URL=redis://localhost:6379"
  );

  // Set up JWT secret
  envContent = envContent.replace(
    "JWT_SECRET=your_jwt_secret_key_here",
    "JWT_SECRET=sweetflips_jwt_secret_key_32_chars_long"
  );

  // Set up encryption key
  envContent = envContent.replace(
    "ENCRYPTION_KEY=your_32_character_encryption_key",
    "ENCRYPTION_KEY=sweetflips_encryption_key_32_chars"
  );

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Updated .env file with bot token and basic settings");
} catch (error) {
  console.log("❌ Could not update .env file:", error.message);
  console.log("Please manually edit apps/api/.env and set:");
  console.log(`TELEGRAM_BOT_TOKEN=${BOT_TOKEN}`);
  console.log(
    "DATABASE_URL=postgresql://postgres:password@localhost:5432/sweetflips_bot"
  );
  console.log("REDIS_URL=redis://localhost:6379");
  console.log("JWT_SECRET=sweetflips_jwt_secret_key_32_chars_long");
  console.log("ENCRYPTION_KEY=sweetflips_encryption_key_32_chars");
}

console.log("\n📋 Next steps:");
console.log("1. Start database services: docker compose up -d postgres redis");
console.log("2. Set up database schema: cd apps/api && npx prisma db push");
console.log("3. Restart the bot: npm run dev");
console.log("4. Message your bot with /start or /kick");
console.log("5. Set yourself as owner: node setup-owner.js");
console.log("\n🎉 Your bot token is configured!");
